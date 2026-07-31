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
      let pageText = cleanText(content.items.map((item) => item.str || '').join(' '));

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
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await ocrWorker.recognize(canvas);
        pageText = cleanText(result.data.text);
      }

      pages.push(pageText);
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }

  return { text: cleanText(pages.join('\n')), pageCount: pdf.numPages, pageCountMode: 'exact' };
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
  return { text, pageCount: estimatedPages, pageCountMode: 'estimated' };
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
    return { text: cleanText(result.data.text), pageCount: 1, pageCountMode: 'exact' };
  } finally {
    await worker.terminate();
  }
};

const extractFileText = async (file, onProgress, options = {}) => {
  const fileName = file.name.toLowerCase();
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) return extractPdfText(file, onProgress, options.maxPdfPages);
  if (fileName.endsWith('.docx')) return extractDocxText(file, options.maxEstimatedWordPages);
  if (file.type === 'text/plain' || fileName.endsWith('.txt')) return { text: cleanText(await file.text()), pageCount: null, pageCountMode: 'not-applicable' };
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
  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];
    onProgress?.(`Lendo ${index + 1} de ${fileList.length}: ${file.name}`);
    const result = await extractFileText(file, onProgress, options);
    if (result.text) parts.push(`Documento: ${file.name}\n${result.text}`);
    pageDetails.push({ fileName: file.name, pageCount: result.pageCount, pageCountMode: result.pageCountMode });
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

export const detectQuestionnaireAnswers = (rawText, questionnaire) => {
  if (!questionnaire?.items?.length || !questionnaire?.options?.length) return {};
  const detected = {};
  let pendingIndex = null;

  rawText.split('\n').forEach((line) => {
    const numbered = line.match(/^\s*(\d{1,3})\s*[.)\-:]\s*(.*)$/);
    if (numbered) {
      const index = Number(numbered[1]) - 1;
      pendingIndex = index >= 0 && index < questionnaire.items.length ? index : null;
      if (pendingIndex !== null) {
        const response = optionForResponse(numbered[2], questionnaire.options);
        if (response) {
          detected[pendingIndex] = response;
          pendingIndex = null;
        }
      }
      return;
    }

    if (pendingIndex !== null && line.trim()) {
      const response = optionForResponse(line, questionnaire.options);
      if (response) detected[pendingIndex] = response;
      pendingIndex = null;
    }
  });

  return detected;
};

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

export const analyzeSchoolCorrectionDocument = (rawText, questionnaire) => {
  const rules = extractCorrectionRules(rawText);
  const detectedAnswers = detectQuestionnaireAnswers(rawText, questionnaire);
  return {
    correctionRules: rules.text,
    rulesFound: rules.found,
    rulesStartLine: rules.startLine,
    detectedAnswers,
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
