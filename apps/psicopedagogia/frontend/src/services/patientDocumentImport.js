const MAX_FILES = 5;
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const MAX_DOCUMENT_REVIEW_TEXT = 100000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const supportedFile = (file) => {
  const fileName = file.name.toLowerCase();
  return file.type === 'application/pdf'
    || fileName.endsWith('.pdf')
    || fileName.endsWith('.docx')
    || fileName.endsWith('.txt')
    || IMAGE_TYPES.has(file.type)
    || /\.(jpe?g|png|webp)$/i.test(fileName);
};

const cleanText = (value) => String(value || '')
  .replace(/\u0000/g, '')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const labelValue = (text, labels) => {
  const expression = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${expression})\\s*[:\\-]\\s*([^\\n]{2,180})`, 'im'));
  return match ? cleanText(match[1]) : '';
};

const labelBlock = (text, labels) => {
  const expression = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${expression})\\s*[:\\-]?\\s*([\\s\\S]{2,900}?)(?=\\n\\s*(?:Nome(?:\\s+completo)?|Data de nascimento|Nascimento|Respons[aá]vel|Telefone|Escola|S[eé]rie|Ano escolar|Queixa|Motivo|Hist[oó]rico|Observa[cç][oõ]es)\\s*[:\\-]|$)`, 'im'));
  return match ? cleanText(match[1]) : '';
};

const parseBirthDate = (value) => {
  if (!value) return '';
  const iso = value.match(/\b(19\d{2}|20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const br = value.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-]((?:19|20)\d{2})\b/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return '';
};

const truncate = (value, maxLength = 1200) => cleanText(value).slice(0, maxLength);

export const extractPatientDraft = (rawText) => {
  const text = cleanText(rawText);
  const name = labelValue(text, ['Nome completo', 'Nome do paciente', 'Nome do adolescente', 'Paciente', 'Aluno(a)', 'Aluno']);
  const birthDate = parseBirthDate(labelValue(text, ['Data de nascimento', 'Nascimento', 'Data nasc.']));
  const guardian = labelValue(text, ['Responsável legal', 'Responsavel legal', 'Nome do responsável', 'Nome do responsavel', 'Responsável', 'Responsavel', 'Mãe', 'Mae', 'Pai']);
  const guardianPhone = labelValue(text, ['Telefone do responsável', 'Telefone do responsavel', 'Telefone', 'Celular', 'WhatsApp']);

  return {
    name: truncate(name, 120),
    birthDate,
    schoolYear: truncate(labelValue(text, ['Série ou ano escolar', 'Serie ou ano escolar', 'Ano escolar', 'Série', 'Serie', 'Turma']), 80),
    school: truncate(labelValue(text, ['Escola', 'Instituição de ensino', 'Instituicao de ensino']), 180),
    guardian: truncate(guardian, 120),
    guardianPhone: truncate(guardianPhone, 50),
    mainConcern: truncate(labelBlock(text, ['Queixa principal', 'Queixa', 'Demanda principal', 'Principal preocupação', 'Principal preocupacao'])),
    evaluationReason: truncate(labelBlock(text, ['Motivo da avaliação', 'Motivo da avaliacao', 'Motivo do encaminhamento', 'Encaminhamento', 'Razão da avaliação', 'Razao da avaliacao'])),
    schoolHistory: truncate(labelBlock(text, ['Histórico escolar', 'Historico escolar', 'Histórico acadêmico', 'Historico academico'])),
    developmentHistory: truncate(labelBlock(text, ['Histórico do desenvolvimento', 'Historico do desenvolvimento', 'Desenvolvimento'])),
    socioemotionalNotes: truncate(labelBlock(text, ['Observações socioemocionais', 'Observacoes socioemocionais', 'Aspectos socioemocionais', 'Histórico socioemocional', 'Historico socioemocional'])),
    observations: truncate(labelBlock(text, ['Observações', 'Observacoes', 'Anotações profissionais', 'Anotacoes profissionais'])),
  };
};

const pdfPageText = (content) => {
  const items = (content.items || [])
    .filter((item) => String(item.str || '').trim())
    .map((item, order) => ({
      text: String(item.str || '').trim(),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      order,
    }));

  if (!items.length) return '';

  // PDF text is usually emitted word by word. Rebuild visual rows before
  // scanning answers so a marked option stays with its numbered item.
  const rows = new Map();
  items.forEach((item) => {
    const rowKey = Math.round(item.y / 4) * 4;
    if (!rows.has(rowKey)) rows.set(rowKey, []);
    rows.get(rowKey).push(item);
  });

  return cleanText([...rows.entries()]
    .sort(([firstY], [secondY]) => secondY - firstY)
    .map(([, row]) => row.sort((first, second) => first.x - second.x || first.order - second.order)
      .map((item) => item.text)
      .join(' '))
    .join('\n'));
};

const extractPdfText = async (file, onProgress, maxPages) => {
  const [{ GlobalWorkerOptions, getDocument }, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  if (maxPages && pdf.numPages > maxPages) {
    throw new Error(`${file.name}: possui ${pdf.numPages} paginas. O limite para a revisao assistida e ${maxPages} paginas por PDF.`);
  }
  const pages = [];
  let ocrWorker;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.(`Lendo PDF: pagina ${pageNumber} de ${pdf.numPages}.`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = pdfPageText(content);
      let ocrUsed = false;

      if (pageText.length < 12) {
        onProgress?.(`PDF escaneado: reconhecendo pagina ${pageNumber} de ${pdf.numPages}.`);
        if (!ocrWorker) {
          const { createWorker } = await import('tesseract.js');
          ocrWorker = await createWorker('por', 1, {
            logger: (message) => {
              if (message.status === 'recognizing text' && typeof message.progress === 'number') {
                onProgress?.(`Reconhecendo texto do PDF: ${Math.round(message.progress * 100)}%.`);
              }
            },
          });
        }
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await ocrWorker.recognize(canvas);
        pageText = cleanText(result.data.text);
        ocrUsed = true;
      }

      pages.push({ pageNumber, text: pageText, ocrUsed });
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }

  return {
    text: cleanText(pages.map((page) => `Pagina ${page.pageNumber}\n${page.text}`).join('\n\n')),
    pageCount: pdf.numPages,
    pageCountMode: 'exact',
    ocrPageCount: pages.filter((page) => page.ocrUsed).length,
    pages,
  };
};

const extractDocxText = async (file, maxEstimatedPages) => {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = cleanText(result.value);
  const estimatedPages = Math.max(1, Math.ceil(text.length / 3000));
  if (maxEstimatedPages && estimatedPages > maxEstimatedPages) {
    throw new Error(`${file.name}: o Word possui aproximadamente ${estimatedPages} paginas de texto. Para a revisao assistida, use ate ${maxEstimatedPages} paginas ou exporte um recorte em PDF.`);
  }
  return {
    text,
    pageCount: estimatedPages,
    pageCountMode: 'estimated',
    ocrPageCount: 0,
    pages: [{ pageNumber: 1, text, ocrUsed: false }],
  };
};

const extractImageText = async (file, onProgress) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.(`Lendo imagem: ${Math.round(message.progress * 100)}%.`);
      }
    },
  });

  try {
    const result = await worker.recognize(file);
    const text = cleanText(result.data.text);
    return { text, pageCount: 1, pageCountMode: 'exact', ocrPageCount: 1, pages: [{ pageNumber: 1, text, ocrUsed: true }] };
  } finally {
    await worker.terminate();
  }
};

const extractFileText = async (file, onProgress, options = {}) => {
  const fileName = file.name.toLowerCase();
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) return extractPdfText(file, onProgress, options.maxPdfPages);
  if (fileName.endsWith('.docx')) return extractDocxText(file, options.maxEstimatedWordPages);
  if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
    const text = cleanText(await file.text());
    return { text, pageCount: null, pageCountMode: 'not-applicable', ocrPageCount: 0, pages: [{ pageNumber: 1, text, ocrUsed: false }] };
  }
  return extractImageText(file, onProgress);
};

export const readImportedDocuments = async (files, onProgress, options = {}) => {
  const fileList = Array.from(files || []);
  const maxFiles = options.maxFiles || MAX_FILES;
  if (!fileList.length) throw new Error('Selecione ao menos um arquivo para leitura.');
  if (fileList.length > maxFiles) throw new Error(`Selecione no maximo ${maxFiles} arquivo(s) por vez.`);

  for (const file of fileList) {
    if (!supportedFile(file)) throw new Error(`${file.name}: formato nao suportado. Use PDF, DOCX, TXT, JPG, PNG ou WEBP.`);
    if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: excede o limite de 12 MB.`);
    if (options.documentOnly && !/\.(pdf|docx)$/i.test(file.name)) throw new Error(`${file.name}: use somente PDF ou Word .docx nesta etapa.`);
  }

  const parts = [];
  const pageDetails = [];
  const pages = [];
  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];
    onProgress?.(`Lendo ${index + 1} de ${fileList.length}: ${file.name}`);
    const result = await extractFileText(file, onProgress, options);
    if (result.text) parts.push(`Documento: ${file.name}\n${result.text}`);
    pageDetails.push({
      fileName: file.name,
      pageCount: result.pageCount,
      pageCountMode: result.pageCountMode,
      ocrPageCount: result.ocrPageCount || 0,
    });
    (result.pages || []).forEach((page) => pages.push({ ...page, fileName: file.name }));
  }

  const rawText = cleanText(parts.join('\n\n'));
  if (!rawText) throw new Error('Nao foi possivel identificar texto legivel nos arquivos selecionados. Tente uma imagem mais nitida ou um PDF/DOCX com texto selecionavel.');
  if (options.maxTextLength && rawText.length > options.maxTextLength) throw new Error(`O texto extraido possui ${rawText.length} caracteres e excede o limite de revisao deste documento. Divida o material em partes menores.`);

  return {
    documents: fileList.map((file) => file.name).join(', '),
    fileNames: fileList.map((file) => file.name),
    text: rawText,
    textLength: rawText.length,
    pageDetails,
    pages,
  };
};

const normalizedMatch = (value) => cleanText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const optionForResponse = (value, options) => {
  const normalized = normalizedMatch(value);
  if (!normalized || normalized.length > 120) return null;
  const candidates = options.filter((option) => {
    const label = normalizedMatch(option.label);
    const id = normalizedMatch(option.id);
    return normalized === label
      || normalized === id
      || normalized === `x ${label}`
      || normalized === `marcado ${label}`
      || normalized === `resposta ${label}`
      || normalized.endsWith(` resposta ${label}`);
  });
  return candidates.length === 1 ? candidates[0].id : null;
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const scanText = (value) => cleanText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[✓✔☒✅]/g, '[x]')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const optionAliases = (option) => [...new Set([option.id, option.label]
  .map((value) => scanText(value))
  .filter(Boolean))]
  .sort((first, second) => second.length - first.length);

const markedOptionIds = (line, options) => {
  const scanned = scanText(line);
  const marked = new Set();
  const marker = '(?:\\[\\s*x\\s*\\]|\\(\\s*x\\s*\\)|\\bx\\b)';

  options.forEach((option) => {
    optionAliases(option).forEach((alias) => {
      const value = escapeRegExp(alias).replace(/\\ /g, '\\s+');
      const before = new RegExp(`${marker}\\s*(?:opcao\\s*)?${value}(?=\\s|$|[|,;])`, 'i');
      const after = new RegExp(`(?:^|\\s)${value}\\s*${marker}(?=\\s|$|[|,;])`, 'i');
      if (before.test(scanned) || after.test(scanned)) marked.add(option.id);
    });
  });

  const explicitNumeric = scanned.match(/(?:resposta|opcao|alternativa|marcacao)\s*(?:e|:|-)?\s*\[?\s*([0-9a-z-]+)\s*\]?/i);
  if (explicitNumeric) {
    const direct = optionForResponse(explicitNumeric[1], options);
    if (direct) marked.add(direct);
  }

  // Grids extracted from PDF often look like: "1 ... 0 1 2 [3]".
  // A bracketed value is accepted only when it matches exactly one option.
  [...scanned.matchAll(/\[\s*([0-9a-z-]+)\s*\]/gi)].forEach((match) => {
    const direct = optionForResponse(match[1], options);
    if (direct) marked.add(direct);
  });

  return [...marked];
};

const exactOptionIds = (value, options) => {
  const cleaned = scanText(value)
    .replace(/^(?:resposta|opcao|alternativa|marcacao|assinalado|marcado)\s*(?:e|:|-)?\s*/i, '')
    .replace(/^(?:\[\s*x\s*\]|\(\s*x\s*\)|x)\s*/, '')
    .trim();
  const direct = optionForResponse(cleaned, options);
  return direct ? [direct] : [];
};

const answerCandidatesFromLine = (line, options) => {
  const marked = markedOptionIds(line, options);
  if (marked.length) return marked;
  return exactOptionIds(line, options);
};

const questionIndexFromLine = (line, questionnaire) => {
  const match = String(line || '').match(/^\s*(?:(?:quest[aã]o|pergunta|item)\s*)?(\d{1,3})\s*(?:[.)\-:|]|\b)/i);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < questionnaire.items.length ? index : null;
};

export const detectQuestionnaireAnswerDetails = (rawText, questionnaire) => {
  if (!questionnaire?.items?.length || !questionnaire?.options?.length) {
    return { answers: {}, evidence: {}, ambiguousItems: [] };
  }

  const answers = {};
  const evidence = {};
  const ambiguous = new Set();
  const lines = cleanText(rawText).split('\n').map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, lineIndex) => {
    const itemIndex = questionIndexFromLine(line, questionnaire);
    if (itemIndex === null || answers[itemIndex] || ambiguous.has(itemIndex)) return;

    const numberedPrefix = line.replace(/^\s*(?:(?:quest[aã]o|pergunta|item)\s*)?\d{1,3}\s*(?:[.)\-:|]|\b)\s*/i, '');
    const candidates = new Set(answerCandidatesFromLine(numberedPrefix, questionnaire.options));

    // Some school forms place the checked alternative on the next visual row.
    for (let offset = 1; candidates.size === 0 && offset <= 3; offset += 1) {
      const following = lines[lineIndex + offset];
      if (!following || questionIndexFromLine(following, questionnaire) !== null) break;
      answerCandidatesFromLine(following, questionnaire.options).forEach((candidate) => candidates.add(candidate));
    }

    if (candidates.size === 1) {
      const answer = [...candidates][0];
      answers[itemIndex] = answer;
      evidence[itemIndex] = line.slice(0, 260);
    } else if (candidates.size > 1) {
      ambiguous.add(itemIndex);
      evidence[itemIndex] = line.slice(0, 260);
    }
  });

  return { answers, evidence, ambiguousItems: [...ambiguous].sort((first, second) => first - second) };
};

export const detectQuestionnaireAnswers = (rawText, questionnaire) => detectQuestionnaireAnswerDetails(rawText, questionnaire).answers;

const CORRECTION_RULE_HEADING = /^\s*(?:\d+[.)\-:]?\s*)?(?:regras?\s+(?:de\s+)?corre[cç][aã]o|crit[eé]rios?\s+(?:de\s+)?corre[cç][aã]o|instru[cç][oõ]es?\s+(?:para\s+)?corre[cç][aã]o|orienta[cç][oõ]es?\s+(?:para\s+)?corre[cç][aã]o|gabarito|pontua[cç][aã]o|corre[cç][aã]o|como\s+corrigir|interpreta[cç][aã]o\s+dos\s+resultados?)\b/i;

export const extractCorrectionRules = (rawText) => {
  const lines = cleanText(rawText).split('\n');
  const startIndex = lines.findIndex((line) => CORRECTION_RULE_HEADING.test(line));
  if (startIndex === -1) return { text: '', found: false, startLine: null };
  return {
    text: cleanText(lines.slice(startIndex).join('\n')).slice(0, 18000),
    found: true,
    startLine: startIndex + 1,
  };
};

const rangeBounds = (range) => {
  const match = String(range || '').match(/(\d+(?:[.,]\d+)?)\s*(?:a|ate|até|-)\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  return { min: Number(match[1].replace(',', '.')), max: Number(match[2].replace(',', '.')) };
};

const documentScoreMap = (rulesText, options) => {
  const source = scanText(rulesText);
  if (!source) return null;
  const scores = {};

  options.forEach((option) => {
    const values = new Set();
    optionAliases(option).forEach((alias) => {
      const escaped = escapeRegExp(alias).replace(/\\ /g, '\\s+');
      const afterLabel = new RegExp(`(?:^|\\s)${escaped}\\s*(?:vale|equivale\\s+a|corresponde\\s+a|=|:|-)\\s*(\\d{1,3})(?=\\s|$|[;,])`, 'i');
      const beforeLabel = new RegExp(`(?:^|\\s)(\\d{1,3})\\s*(?:=|:|-)\\s*${escaped}(?=\\s|$|[;,])`, 'i');
      const match = source.match(afterLabel) || source.match(beforeLabel);
      if (match) values.add(Number(match[1]));
    });
    if (values.size === 1) scores[option.id] = [...values][0];
  });

  return Object.keys(scores).length === options.length ? scores : null;
};

const documentScoreRanges = (rulesText) => cleanText(rulesText)
  .split('\n')
  .map((line) => {
    const match = line.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:a|ate|até|-)\s*(\d+(?:[.,]\d+)?)\s*(?:pontos?)?\s*(?:-|:|=)\s*(.{3,160})$/i);
    if (!match) return null;
    return {
      range: `${match[1]} a ${match[2]}`,
      label: cleanText(match[3]),
    };
  })
  .filter(Boolean);

const scoreMapForQuestionnaire = (questionnaire, rulesText) => {
  const configured = Object.fromEntries((questionnaire.options || [])
    .filter((option) => typeof option.score === 'number')
    .map((option) => [option.id, option.score]));
  if (Object.keys(configured).length === questionnaire.options.length) {
    return { scores: configured, source: 'instrumento' };
  }
  const fromDocument = documentScoreMap(rulesText, questionnaire.options || []);
  return fromDocument ? { scores: fromDocument, source: 'documento' } : null;
};

export const calculateQuestionnaireOutcome = (questionnaire, answers, rulesText = '') => {
  if (!questionnaire?.items?.length || !questionnaire?.options?.length) return null;
  const answerMap = answers || {};
  const answeredCount = questionnaire.items.filter((_, index) => Boolean(answerMap[index])).length;
  const missingItems = questionnaire.items.map((_, index) => index).filter((index) => !answerMap[index]);
  const scoreMap = scoreMapForQuestionnaire(questionnaire, rulesText);
  const complete = answeredCount === questionnaire.items.length;

  if (!scoreMap) {
    return {
      complete,
      canScore: false,
      answeredCount,
      totalItems: questionnaire.items.length,
      missingItems,
      score: null,
      maximum: null,
      percentage: null,
      classification: 'Informacoes parciais do documento',
      observation: complete
        ? 'Respostas preenchidas. O documento nao trouxe regra suficiente para calcular pontuacao, maximo ou classificacao.'
        : `${answeredCount} de ${questionnaire.items.length} respostas preenchidas; faltam ${missingItems.length} item(ns).`,
      source: null,
      sourceLabel: 'Sem regra de pontuacao automatica',
    };
  }

  const score = questionnaire.items.reduce((total, _, index) => total + (scoreMap.scores[answerMap[index]] ?? 0), 0);
  const theoreticalMaximum = questionnaire.items.length * Math.max(...Object.values(scoreMap.scores));
  const maximum = Number(questionnaire.maximum) || theoreticalMaximum;
  const percentage = maximum > 0 ? Number(((score / maximum) * 100).toFixed(1)) : null;
  const ranges = questionnaire.ranges?.length ? questionnaire.ranges : documentScoreRanges(rulesText);
  const matchedRange = complete ? ranges.find((item) => {
    const bounds = rangeBounds(item.range);
    return bounds && score >= bounds.min && score <= bounds.max;
  }) : null;
  const classification = !complete
    ? 'Preenchimento incompleto'
    : matchedRange?.label || 'Pontuacao calculada - revisar classificacao';

  return {
    complete,
    canScore: true,
    answeredCount,
    totalItems: questionnaire.items.length,
    missingItems,
    score,
    maximum,
    percentage,
    classification,
    observation: complete
      ? `Pontuacao calculada automaticamente pela regra do ${scoreMap.source}. Conferir com o documento e o manual aplicavel antes de concluir.`
      : `Pontuacao parcial calculada pela regra do ${scoreMap.source}. Faltam ${missingItems.length} item(ns) para o resultado final.`,
    source: scoreMap.source,
    sourceLabel: scoreMap.source === 'instrumento' ? 'Regra cadastrada no instrumento' : 'Regra identificada no documento',
  };
};

export const analyzeSchoolCorrectionDocument = (rawText, questionnaire) => {
  const rules = extractCorrectionRules(rawText);
  const answerAnalysis = detectQuestionnaireAnswerDetails(rawText, questionnaire);
  return {
    correctionRules: rules.text,
    rulesFound: rules.found,
    rulesStartLine: rules.startLine,
    detectedAnswers: answerAnalysis.answers,
    answerAnalysis,
    automaticOutcome: calculateQuestionnaireOutcome(questionnaire, answerAnalysis.answers, rules.text),
  };
};

export const SCHOOL_DOCUMENT_OPTIONS = {
  documentOnly: true,
  maxFiles: 1,
  maxPdfPages: 20,
  maxEstimatedWordPages: 20,
  maxTextLength: MAX_DOCUMENT_REVIEW_TEXT,
};

export const importPatientDocuments = async (files, onProgress) => {
  const imported = await readImportedDocuments(files, onProgress);
  return {
    ...imported,
    extracted: extractPatientDraft(imported.text),
  };
};
