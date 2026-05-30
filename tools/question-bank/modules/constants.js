// kikkua · 题库编辑器 — 常量定义

export const OPT_LETTERS = ['A','B','C','D','E','F','G'];

export const VALID_TYPES = ['单选题','多选题','判断题','问答题','挖空题'];

export const TYPE_LOCK_MAP = {
    '单选题':  ['clozetext','answertext'],
    '多选题':  ['clozetext','answertext'],
    '判断题':  ['clozetext','answertext','optA','optB','optC','optD','optE','optF','optG'],
    '问答题':  ['clozetext','optA','optB','optC','optD','optE','optF','optG','answer'],
    '挖空题':  ['optA','optB','optC','optD','optE','optF','optG','answer','answertext','question'],
};

export const FORM_FIELDS = [
    { key: 'type', label: 'Type', type: 'select' },
    { key: 'chapter', label: 'Chapter', type: 'text' },
    { key: 'question', label: 'Question', type: 'textarea' },
    { key: 'clozetext', label: 'Clozetext', type: 'textarea' },
    { key: 'optA', label: 'Option A', type: 'textarea' },
    { key: 'optB', label: 'Option B', type: 'textarea' },
    { key: 'optC', label: 'Option C', type: 'textarea' },
    { key: 'optD', label: 'Option D', type: 'textarea' },
    { key: 'optE', label: 'Option E', type: 'textarea' },
    { key: 'optF', label: 'Option F', type: 'textarea' },
    { key: 'optG', label: 'Option G', type: 'textarea' },
    { key: 'answer', label: 'Answer', type: 'text' },
    { key: 'answertext', label: 'AnswerText', type: 'textarea' },
    { key: 'analysis', label: 'Analysis', type: 'textarea' },
    { key: 'reference', label: 'Reference', type: 'textarea' },
];

export const FILL_COLS = ['type', 'chapter'];

export const PASTE_COL_ORDER = ['chapter','type','question','clozetext','optA','optB','optC','optD','optE','optF','optG','answer','answertext','analysis','reference'];

export const ANALYSIS_STYLE_MAP = {
    default:  '清晰准确地撰写解析，点明正确答案的依据，30~60 字',
    simple:   '用通俗易懂的语言撰写解析，避免专业术语，像老师给初学者讲解一样，30~60 字',
    detailed: '详细撰写解析，展开相关知识点的背景、原理和延伸，帮助深入理解，80~150 字',
    brief:    '简洁精炼地撰写解析，只点明核心要点，15~30 字',
    example:  '结合具体实例撰写解析，先说明原理，再举一个实际案例帮助理解，60~100 字',
};

export const CACHE_KEY = 'kikkua_qb_data';

export const FIELD_LABELS = { question:'题干', clozetext:'Cloze', answertext:'答案文本', analysis:'解析', reference:'参考' };
