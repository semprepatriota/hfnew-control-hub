const MAX_FILES = 5;
const MAX_FILE_SIZE = 12 * 1024 * 1024;
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

const extractPdfText = async (file, onProgress) => {
  const [{ GlobalWorkerOptions, getDocument }, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.(`Lendo PDF: pagina ${pageNumber} de ${pdf.numPages}.`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || '').join(' '));
  }

  return cleanText(pages.join('\n'));
};

const extractDocxText = async (file) => {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return cleanText(result.value);
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
    return cleanText(result.data.text);
  } finally {
    await worker.terminate();
  }
};

const extractFileText = async (file, onProgress) => {
  const fileName = file.name.toLowerCase();
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) return extractPdfText(file, onProgress);
  if (fileName.endsWith('.docx')) return extractDocxText(file);
  if (file.type === 'text/plain' || fileName.endsWith('.txt')) return cleanText(await file.text());
  return extractImageText(file, onProgress);
};

export const importPatientDocuments = async (files, onProgress) => {
  const fileList = Array.from(files || []);
  if (!fileList.length) throw new Error('Selecione ao menos um arquivo para leitura.');
  if (fileList.length > MAX_FILES) throw new Error(`Selecione no maximo ${MAX_FILES} arquivos por vez.`);

  for (const file of fileList) {
    if (!supportedFile(file)) throw new Error(`${file.name}: formato nao suportado. Use PDF, DOCX, TXT, JPG, PNG ou WEBP.`);
    if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: excede o limite de 12 MB.`);
  }

  const parts = [];
  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];
    onProgress?.(`Lendo ${index + 1} de ${fileList.length}: ${file.name}`);
    const text = await extractFileText(file, onProgress);
    if (text) parts.push(`Documento: ${file.name}\n${text}`);
  }

  const rawText = cleanText(parts.join('\n\n'));
  if (!rawText) throw new Error('Nao foi possivel identificar texto legivel nos arquivos selecionados. Tente uma imagem mais nitida ou um PDF/DOCX com texto selecionavel.');

  const extracted = extractPatientDraft(rawText);
  const documents = fileList.map((file) => file.name).join(', ');
  return { extracted, documents, textLength: rawText.length };
};
