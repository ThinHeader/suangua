export type CoinFace = 'heads' | 'tails'
export type CoinLineValue = 6 | 7 | 8 | 9
export type BinaryLine = 0 | 1
export type FiveElement = '金' | '木' | '水' | '火' | '土'

export interface TrigramInfo {
  id: string
  name: string
  symbol: string
  number: number
  element: FiveElement
  nature: string
  lines: [BinaryLine, BinaryLine, BinaryLine]
}

export interface HexagramInfo {
  key: string
  name: string
  shortName: string
  judgement: string
  summary: string
}

export interface HexagramSnapshot {
  upperTrigram: TrigramInfo
  lowerTrigram: TrigramInfo
  hexagram: HexagramInfo
  lines: BinaryLine[]
}

export interface MovingLineInfo {
  position: number
  name: string
  originalValue: CoinLineValue
  transformText: string
  advice: string
}

export interface CoinReadingResult {
  baseHexagram: HexagramSnapshot
  changedHexagram: HexagramSnapshot
  movingLines: MovingLineInfo[]
  movingSummary: string
  judgementRule: CoinJudgementRule
  lineValues: CoinLineValue[]
}

export interface CoinJudgementRule {
  title: string
  summary: string
  primaryFocus: string
  secondaryFocus?: string
  referencedLines: number[]
}

export interface ElementRelation {
  label: string
  description: string
}

export interface MeihuaReadingResult {
  firstNumber: number
  secondNumber: number
  upperTrigram: TrigramInfo
  lowerTrigram: TrigramInfo
  bodyTrigram: TrigramInfo
  useTrigram: TrigramInfo
  movingLine: number
  movingLineName: string
  movingAdvice: string
  baseHexagram: HexagramSnapshot
  changedHexagram: HexagramSnapshot
  relation: ElementRelation
  bodyUseSummary: string
}

// 这里使用梅花易数里常见的数字配八卦顺序：
// 1 乾、2 兑、3 离、4 震、5 巽、6 坎、7 艮、8 坤。
const TRIGRAMS: Record<string, TrigramInfo> = {
  qian: {
    id: 'qian',
    name: '乾',
    symbol: '天',
    number: 1,
    element: '金',
    nature: '刚健、开创、主导',
    lines: [1, 1, 1],
  },
  dui: {
    id: 'dui',
    name: '兑',
    symbol: '泽',
    number: 2,
    element: '金',
    nature: '沟通、喜悦、表达',
    lines: [1, 1, 0],
  },
  li: {
    id: 'li',
    name: '离',
    symbol: '火',
    number: 3,
    element: '火',
    nature: '光明、判断、显化',
    lines: [1, 0, 1],
  },
  zhen: {
    id: 'zhen',
    name: '震',
    symbol: '雷',
    number: 4,
    element: '木',
    nature: '启动、突破、行动',
    lines: [1, 0, 0],
  },
  xun: {
    id: 'xun',
    name: '巽',
    symbol: '风',
    number: 5,
    element: '木',
    nature: '渗透、协商、布局',
    lines: [0, 1, 1],
  },
  kan: {
    id: 'kan',
    name: '坎',
    symbol: '水',
    number: 6,
    element: '水',
    nature: '风险、流动、应变',
    lines: [0, 1, 0],
  },
  gen: {
    id: 'gen',
    name: '艮',
    symbol: '山',
    number: 7,
    element: '土',
    nature: '止守、边界、沉稳',
    lines: [0, 0, 1],
  },
  kun: {
    id: 'kun',
    name: '坤',
    symbol: '地',
    number: 8,
    element: '土',
    nature: '承载、配合、包容',
    lines: [0, 0, 0],
  },
}

const TRIGRAM_BY_NUMBER: Record<number, TrigramInfo> = {
  1: TRIGRAMS.qian,
  2: TRIGRAMS.dui,
  3: TRIGRAMS.li,
  4: TRIGRAMS.zhen,
  5: TRIGRAMS.xun,
  6: TRIGRAMS.kan,
  7: TRIGRAMS.gen,
  8: TRIGRAMS.kun,
}

const LINE_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const

// 这里不强塞整套古文爻辞，而是给出更适合网页阅读的“动位提示”。
// 这样用户能快速理解当前变化落在事情的哪个阶段。
const POSITION_ADVICE: Record<number, string> = {
  1: '事情刚刚起步，先立规矩和方向，宁可慢一点，也别急于求成。',
  2: '局面进入承接阶段，适合找稳妥的人与方法，把基础做实。',
  3: '转折压力开始出现，最怕硬顶，宜先化阻力、再谋推进。',
  4: '外部机会与约束同时增强，关键在分寸感，少做多余动作。',
  5: '进入主导位置，影响力变强，越要守中守正，避免得意忘形。',
  6: '事情接近尾声，重点是收束和复盘，不宜继续盲目加码。',
}

const CHANGE_TEXT: Record<CoinLineValue, string> = {
  6: '老阴变阳，表示由守转进，僵局中会出现突破口。',
  7: '少阳不变，当前主动性存在，但整体格局仍以本卦为主。',
  8: '少阴不变，当前更适合观察与蓄势，不宜急推结果。',
  9: '老阳变阴，表示由进转守，强势之后要学会柔化和调整。',
}

// 六十四卦采用“上卦-下卦”的 key 方式存储。
// judgement 用一句话给出卦辞式结论，summary 用现代语言补充阅读重点。
const HEXAGRAMS: Record<string, HexagramInfo> = {
  'qian-qian': {
    key: 'qian-qian',
    name: '乾为天',
    shortName: '乾',
    judgement: '元亨利贞，自强不息。',
    summary: '适合主动开局、树立目标，但越强势越要守住原则。',
  },
  'kun-kun': {
    key: 'kun-kun',
    name: '坤为地',
    shortName: '坤',
    judgement: '厚德载物，以柔顺承事。',
    summary: '宜先配合大势、稳住基础，靠承载力与耐心取得结果。',
  },
  'kan-zhen': {
    key: 'kan-zhen',
    name: '水雷屯',
    shortName: '屯',
    judgement: '起始多难，利于守正。',
    summary: '开局不顺很正常，重点不是抢快，而是先把路走稳。',
  },
  'gen-kan': {
    key: 'gen-kan',
    name: '山水蒙',
    shortName: '蒙',
    judgement: '启蒙求正，先难后明。',
    summary: '适合学习、请教与校正认知，忌自以为是。',
  },
  'kan-qian': {
    key: 'kan-qian',
    name: '水天需',
    shortName: '需',
    judgement: '待时而动，以诚致通。',
    summary: '时机未熟时应耐心准备，急推反而会拖慢节奏。',
  },
  'qian-kan': {
    key: 'qian-kan',
    name: '天水讼',
    shortName: '讼',
    judgement: '争端宜止，慎言慎行。',
    summary: '若局势已经对立，优先化解冲突比争输赢更重要。',
  },
  'kun-kan': {
    key: 'kun-kan',
    name: '地水师',
    shortName: '师',
    judgement: '统众以正，纪律为先。',
    summary: '涉及团队、组织或执行时，规矩比激情更关键。',
  },
  'kan-kun': {
    key: 'kan-kun',
    name: '水地比',
    shortName: '比',
    judgement: '亲比协作，以诚相辅。',
    summary: '靠互信与结盟成事，贵在真诚，而非短期算计。',
  },
  'xun-qian': {
    key: 'xun-qian',
    name: '风天小畜',
    shortName: '小畜',
    judgement: '积小成大，宜蓄势待发。',
    summary: '眼下更适合累积资源与口碑，不宜急着一步到位。',
  },
  'qian-dui': {
    key: 'qian-dui',
    name: '天泽履',
    shortName: '履',
    judgement: '循礼而行，谨慎前进。',
    summary: '局势允许推进，但必须讲方法、讲边界、讲分寸。',
  },
  'kun-qian': {
    key: 'kun-qian',
    name: '地天泰',
    shortName: '泰',
    judgement: '上下交泰，万事渐通。',
    summary: '整体气机顺畅，适合拓展、合作与落实计划。',
  },
  'qian-kun': {
    key: 'qian-kun',
    name: '天地否',
    shortName: '否',
    judgement: '闭塞不通，宜守正避险。',
    summary: '外部阻滞偏多，不要强行突破，先保全核心部分。',
  },
  'qian-li': {
    key: 'qian-li',
    name: '天火同人',
    shortName: '同人',
    judgement: '同心协力，可以成事。',
    summary: '适合联合志同道合者，公开透明比暗中运作更顺。',
  },
  'li-qian': {
    key: 'li-qian',
    name: '火天大有',
    shortName: '大有',
    judgement: '光明丰盛，所求有得。',
    summary: '资源和机会都较足，但要防止因顺利而忽略约束。',
  },
  'kun-gen': {
    key: 'kun-gen',
    name: '地山谦',
    shortName: '谦',
    judgement: '谦而受益，退让得吉。',
    summary: '越有实力越要克制姿态，谦逊本身就是护身符。',
  },
  'zhen-kun': {
    key: 'zhen-kun',
    name: '雷地豫',
    shortName: '豫',
    judgement: '顺势而动，喜中有备。',
    summary: '气氛向好，适合发动项目，但不能只顾热闹不顾落地。',
  },
  'dui-zhen': {
    key: 'dui-zhen',
    name: '泽雷随',
    shortName: '随',
    judgement: '顺时随势，从善而行。',
    summary: '眼下不必硬造新路，跟对节奏、跟对方向更重要。',
  },
  'gen-xun': {
    key: 'gen-xun',
    name: '山风蛊',
    shortName: '蛊',
    judgement: '整弊除旧，先治后兴。',
    summary: '先处理旧问题与烂摊子，修复后才能迎来增长。',
  },
  'kun-dui': {
    key: 'kun-dui',
    name: '地泽临',
    shortName: '临',
    judgement: '临事以诚，渐进有功。',
    summary: '适合向下深入、亲自靠近问题，越实地越能见效。',
  },
  'xun-kun': {
    key: 'xun-kun',
    name: '风地观',
    shortName: '观',
    judgement: '先观其势，再定其行。',
    summary: '这是观察窗口期，收集信息与校准判断比抢动作更值钱。',
  },
  'li-zhen': {
    key: 'li-zhen',
    name: '火雷噬嗑',
    shortName: '噬嗑',
    judgement: '果断处置，先难后通。',
    summary: '遇到卡点要有决断，拖延只会让问题更硬。',
  },
  'gen-li': {
    key: 'gen-li',
    name: '山火贲',
    shortName: '贲',
    judgement: '文质相辅，修饰有度。',
    summary: '适合包装、表达和优化呈现，但不要本末倒置。',
  },
  'gen-kun': {
    key: 'gen-kun',
    name: '山地剥',
    shortName: '剥',
    judgement: '剥落衰退，宜静守。',
    summary: '不利扩张，重点是止损、收缩和保护核心资源。',
  },
  'kun-zhen': {
    key: 'kun-zhen',
    name: '地雷复',
    shortName: '复',
    judgement: '返本归正，阳气初回。',
    summary: '旧局开始修复，是重新起步和回到正轨的信号。',
  },
  'qian-zhen': {
    key: 'qian-zhen',
    name: '天雷无妄',
    shortName: '无妄',
    judgement: '守正无妄，自然有得。',
    summary: '不要侥幸与投机，真诚做事反而更容易有收获。',
  },
  'gen-qian': {
    key: 'gen-qian',
    name: '山天大畜',
    shortName: '大畜',
    judgement: '蓄德积力，待时大用。',
    summary: '这是积累实力的阶段，忍得住，后劲就大。',
  },
  'gen-zhen': {
    key: 'gen-zhen',
    name: '山雷颐',
    shortName: '颐',
    judgement: '养正则吉，慎言慎养。',
    summary: '适合修身、养气、固本，先把内核养稳再谈输出。',
  },
  'dui-xun': {
    key: 'dui-xun',
    name: '泽风大过',
    shortName: '大过',
    judgement: '负重过大，宜速调平衡。',
    summary: '压力已超常态，必须尽快调结构、卸负担。',
  },
  'kan-kan': {
    key: 'kan-kan',
    name: '坎为水',
    shortName: '坎',
    judgement: '行险有险，贵在守心。',
    summary: '风险处处在，越在复杂环境越要冷静和有节奏。',
  },
  'li-li': {
    key: 'li-li',
    name: '离为火',
    shortName: '离',
    judgement: '光明附丽，利于明辨。',
    summary: '适合曝光、表达、判断与看清真相，但忌虚火太盛。',
  },
  'dui-gen': {
    key: 'dui-gen',
    name: '泽山咸',
    shortName: '咸',
    judgement: '感应相通，利于结合。',
    summary: '人与人、资源与资源之间容易产生连接，宜真诚互动。',
  },
  'zhen-xun': {
    key: 'zhen-xun',
    name: '雷风恒',
    shortName: '恒',
    judgement: '守常有成，持久为吉。',
    summary: '持续性胜过一时爆发，把正确动作稳定做下去更重要。',
  },
  'qian-gen': {
    key: 'qian-gen',
    name: '天山遁',
    shortName: '遁',
    judgement: '退避有道，明哲保身。',
    summary: '该退的时候要退，退不是输，而是换取更好的节奏。',
  },
  'zhen-qian': {
    key: 'zhen-qian',
    name: '雷天大壮',
    shortName: '大壮',
    judgement: '阳盛可进，仍须守礼。',
    summary: '势头很强，但越强越不能失控，礼法就是刹车。',
  },
  'li-kun': {
    key: 'li-kun',
    name: '火地晋',
    shortName: '晋',
    judgement: '日进有功，宜见贵人。',
    summary: '事业和影响力有上升空间，主动争取支持更有利。',
  },
  'kun-li': {
    key: 'kun-li',
    name: '地火明夷',
    shortName: '明夷',
    judgement: '晦而不伤，藏明待时。',
    summary: '当下不适合锋芒太露，先保留实力，等局面转暖。',
  },
  'xun-li': {
    key: 'xun-li',
    name: '风火家人',
    shortName: '家人',
    judgement: '齐家有序，各安其位。',
    summary: '适合处理团队分工、家庭关系或组织秩序问题。',
  },
  'li-dui': {
    key: 'li-dui',
    name: '火泽睽',
    shortName: '睽',
    judgement: '异中求同，先难后解。',
    summary: '分歧明显时别急于统一口径，先找到共同利益点。',
  },
  'kan-gen': {
    key: 'kan-gen',
    name: '水山蹇',
    shortName: '蹇',
    judgement: '行路艰难，宜反身修整。',
    summary: '推进吃力时，最该做的是回头检查方法和资源。',
  },
  'zhen-kan': {
    key: 'zhen-kan',
    name: '雷水解',
    shortName: '解',
    judgement: '解结释困，动中得通。',
    summary: '僵局有望被打开，适合尽快把积压问题一一拆解。',
  },
  'gen-dui': {
    key: 'gen-dui',
    name: '山泽损',
    shortName: '损',
    judgement: '减负有益，舍小取大。',
    summary: '减法就是当前最有效的进步方式，先砍枝蔓。',
  },
  'xun-zhen': {
    key: 'xun-zhen',
    name: '风雷益',
    shortName: '益',
    judgement: '增益其事，利有攸往。',
    summary: '资源开始向你聚拢，适合加码有把握的方向。',
  },
  'dui-qian': {
    key: 'dui-qian',
    name: '泽天夬',
    shortName: '夬',
    judgement: '决而能断，去旧立新。',
    summary: '现在最怕犹豫，该切割的切割，该表态的表态。',
  },
  'qian-xun': {
    key: 'qian-xun',
    name: '天风姤',
    shortName: '姤',
    judgement: '猝然相遇，宜辨善恶。',
    summary: '新的机会或变量来得很快，先辨别质量再决定靠近。',
  },
  'dui-kun': {
    key: 'dui-kun',
    name: '泽地萃',
    shortName: '萃',
    judgement: '聚众成势，以诚得众。',
    summary: '适合做资源整合、社群组织或团队会合，但核心要真。',
  },
  'kun-xun': {
    key: 'kun-xun',
    name: '地风升',
    shortName: '升',
    judgement: '由下而上，稳步提升。',
    summary: '局势正在上行，按部就班比跳跃式推进更稳。',
  },
  'dui-kan': {
    key: 'dui-kan',
    name: '泽水困',
    shortName: '困',
    judgement: '困而求通，守志待援。',
    summary: '现实约束偏强，先稳住心志，再等待外部松动。',
  },
  'kan-xun': {
    key: 'kan-xun',
    name: '水风井',
    shortName: '井',
    judgement: '修井养人，贵在恒常。',
    summary: '适合建设长期价值，别被短期波动打断日常积累。',
  },
  'dui-li': {
    key: 'dui-li',
    name: '泽火革',
    shortName: '革',
    judgement: '变革更新，顺势而为。',
    summary: '旧模式已经不够用了，该换结构、换策略、换节奏。',
  },
  'li-xun': {
    key: 'li-xun',
    name: '火风鼎',
    shortName: '鼎',
    judgement: '定器成化，革故鼎新。',
    summary: '不是小修小补，而是建立新秩序和新容器的时候。',
  },
  'zhen-zhen': {
    key: 'zhen-zhen',
    name: '震为雷',
    shortName: '震',
    judgement: '有惊无险，动而后吉。',
    summary: '突发变化会带来震动，但保持行动与定力就能转吉。',
  },
  'gen-gen': {
    key: 'gen-gen',
    name: '艮为山',
    shortName: '艮',
    judgement: '知止能安，静中得定。',
    summary: '该停的时候停，先止损、止念、止躁，再看下一步。',
  },
  'xun-gen': {
    key: 'xun-gen',
    name: '风山渐',
    shortName: '渐',
    judgement: '循序渐进，稳中见喜。',
    summary: '慢不是坏事，只要方向对，渐进反而更容易成功。',
  },
  'zhen-dui': {
    key: 'zhen-dui',
    name: '雷泽归妹',
    shortName: '归妹',
    judgement: '情势未正，宜谨慎择合。',
    summary: '关系、合作或承诺若基础不稳，宁可慢一点再定。',
  },
  'zhen-li': {
    key: 'zhen-li',
    name: '雷火丰',
    shortName: '丰',
    judgement: '丰盛盈满，防盛极而衰。',
    summary: '眼下看似饱满有势，但越热越要防后劲不足。',
  },
  'li-gen': {
    key: 'li-gen',
    name: '火山旅',
    shortName: '旅',
    judgement: '行旅在外，宜守分自持。',
    summary: '局面偏临时、偏异地或偏过渡，适合轻装与自律。',
  },
  'xun-xun': {
    key: 'xun-xun',
    name: '巽为风',
    shortName: '巽',
    judgement: '以柔入事，顺而能达。',
    summary: '不靠硬冲，而靠渗透、协商和持续布局取胜。',
  },
  'dui-dui': {
    key: 'dui-dui',
    name: '兑为泽',
    shortName: '兑',
    judgement: '和悦以说，利于沟通。',
    summary: '适合谈判、表达、达成一致，但别只顾好听不顾落实。',
  },
  'xun-kan': {
    key: 'xun-kan',
    name: '风水涣',
    shortName: '涣',
    judgement: '涣散求聚，先散后成。',
    summary: '先把堵塞化开，再重新组织，别在僵团上硬压。',
  },
  'kan-dui': {
    key: 'kan-dui',
    name: '水泽节',
    shortName: '节',
    judgement: '有节有度，守界成事。',
    summary: '规则、预算、边界越清楚，事情反而越容易推进。',
  },
  'xun-dui': {
    key: 'xun-dui',
    name: '风泽中孚',
    shortName: '中孚',
    judgement: '诚信为本，内外相应。',
    summary: '这卦重真诚和信任，一旦失信，后续推进会明显受阻。',
  },
  'zhen-gen': {
    key: 'zhen-gen',
    name: '雷山小过',
    shortName: '小过',
    judgement: '小事可成，大事宜慎。',
    summary: '可做局部调整和精细动作，不宜一下子赌大方向。',
  },
  'kan-li': {
    key: 'kan-li',
    name: '水火既济',
    shortName: '既济',
    judgement: '事已成形，仍防反复。',
    summary: '成果已经出现，但真正的考验是后续维稳和收尾。',
  },
  'li-kan': {
    key: 'li-kan',
    name: '火水未济',
    shortName: '未济',
    judgement: '事未竟成，耐心收尾。',
    summary: '距离完成只差最后一段，最忌提前松懈或判断过满。',
  },
}

function normalizeModulo(value: number, divisor: number): number {
  const normalized = ((value % divisor) + divisor) % divisor
  return normalized === 0 ? divisor : normalized
}

function buildHexagramKey(upperId: string, lowerId: string): string {
  return `${upperId}-${lowerId}`
}

function flipLine(line: BinaryLine): BinaryLine {
  return line === 1 ? 0 : 1
}

function getTrigramByLines(lines: BinaryLine[]): TrigramInfo {
  const target = Object.values(TRIGRAMS).find((trigram) =>
    trigram.lines.every((line, index) => line === lines[index]),
  )

  if (!target) {
    throw new Error('无法根据三爻匹配八卦，请检查输入数据。')
  }

  return target
}

function createHexagramSnapshot(lines: BinaryLine[]): HexagramSnapshot {
  const lowerLines = lines.slice(0, 3) as [BinaryLine, BinaryLine, BinaryLine]
  const upperLines = lines.slice(3, 6) as [BinaryLine, BinaryLine, BinaryLine]
  const lowerTrigram = getTrigramByLines(lowerLines)
  const upperTrigram = getTrigramByLines(upperLines)
  const key = buildHexagramKey(upperTrigram.id, lowerTrigram.id)
  const hexagram = HEXAGRAMS[key]

  if (!hexagram) {
    throw new Error(`未找到六十四卦映射：${key}`)
  }

  return {
    upperTrigram,
    lowerTrigram,
    hexagram,
    lines,
  }
}

function getMovingSummary(movingLines: MovingLineInfo[]): string {
  if (movingLines.length === 0) {
    return '本次起卦没有动爻，以本卦含义为主，重在看当前局势。'
  }

  if (movingLines.length === 1) {
    return '本次只有一爻发动，可优先参考这一爻所处阶段带来的变化。'
  }

  if (movingLines.length >= 4) {
    return '动爻较多，说明局势变化快，变卦的参考权重会明显上升。'
  }

  return '动爻不止一处，表示事情正在多点变化，需要同时兼顾节奏与方向。'
}

function getCoinJudgementRule(
  movingLines: MovingLineInfo[],
  baseHexagram: HexagramSnapshot,
  changedHexagram: HexagramSnapshot,
): CoinJudgementRule {
  const movingCount = movingLines.length
  const referencedLines = movingLines.map((item) => item.position)
  const stillLines = [1, 2, 3, 4, 5, 6].filter((position) => !referencedLines.includes(position))

  // 这里按常见的“六爻占断取用规则”给出主判逻辑：
  // 0 动看本卦；1 动看本卦动爻；2 动看本卦两动爻以上者为主；
  // 3 动兼看本卦与变卦，以本卦为主；4 动看变卦两静爻；
  // 5 动看变卦唯一静爻；6 动通常看变卦，乾坤可兼参用九/用六精神。
  if (movingCount === 0) {
    return {
      title: '无动爻',
      summary: '依传统取法，无动爻时以本卦卦意为主，不专取某一爻。',
      primaryFocus: `主看本卦《${baseHexagram.hexagram.name}》的整体卦意与卦辞。`,
      secondaryFocus: '这类情况更强调“局势本身”，说明事情暂时没有明显转折点。',
      referencedLines: [],
    }
  }

  if (movingCount === 1) {
    const line = movingLines[0]

    return {
      title: '一动爻',
      summary: '依传统取法，一动爻时以本卦的该动爻为主，变卦作辅助参考。',
      primaryFocus: `主看本卦《${baseHexagram.hexagram.name}》的${line.name}。`,
      secondaryFocus: `变卦《${changedHexagram.hexagram.name}》用于辅助判断后续走向。`,
      referencedLines: [line.position],
    }
  }

  if (movingCount === 2) {
    const sorted = [...movingLines].sort((a, b) => a.position - b.position)
    const upperLine = sorted[1]

    return {
      title: '二动爻',
      summary: '依传统取法，二动爻时两爻都看，但通常以上面的那一动爻为主。',
      primaryFocus: `主看本卦《${baseHexagram.hexagram.name}》的${upperLine.name}，并兼看另一动爻。`,
      secondaryFocus: `变卦《${changedHexagram.hexagram.name}》用于观察变化后的整体落点。`,
      referencedLines: sorted.map((item) => item.position),
    }
  }

  if (movingCount === 3) {
    return {
      title: '三动爻',
      summary: '依传统取法，三动爻时本卦与变卦都要看，但以本卦卦意为主。',
      primaryFocus: `先看本卦《${baseHexagram.hexagram.name}》说明当前处境，再看变卦《${changedHexagram.hexagram.name}》说明演化方向。`,
      secondaryFocus: '三处同时发动，表示局势正处在明显转折期，不宜只盯某一爻。',
      referencedLines,
    }
  }

  if (movingCount === 4) {
    const focusLines = stillLines.slice(0, 2)
    const focusNames = focusLines.map((position) => getLineName(position)).join('、')

    return {
      title: '四动爻',
      summary: '依传统取法，四动爻时转而看变卦中未动的两爻。',
      primaryFocus: `主看变卦《${changedHexagram.hexagram.name}》中未动的两爻：${focusNames}。`,
      secondaryFocus: '四处已变，说明原局大半已松动，取静爻更能抓住相对稳定的落点。',
      referencedLines: focusLines,
    }
  }

  if (movingCount === 5) {
    const focusLine = stillLines[0]

    return {
      title: '五动爻',
      summary: '依传统取法，五动爻时主看变卦中唯一未动的一爻。',
      primaryFocus: `主看变卦《${changedHexagram.hexagram.name}》的${getLineName(focusLine)}。`,
      secondaryFocus: '五处皆变，只剩一爻不动，这一爻通常就是判断结果的关键锚点。',
      referencedLines: focusLine ? [focusLine] : [],
    }
  }

  const isQian = baseHexagram.hexagram.key === 'qian-qian'
  const isKun = baseHexagram.hexagram.key === 'kun-kun'
  const extraNote = isQian
    ? '本卦为乾，可兼参“用九”的精神，重在刚健而知进退。'
    : isKun
      ? '本卦为坤，可兼参“用六”的精神，重在柔顺而守其正。'
      : '六爻全动时，原局已经整体转换，通常以变卦为主。'

  return {
    title: '六动爻',
    summary: '依传统取法，六动爻时通常以变卦为主；乾坤两卦可兼参用九、用六之义。',
    primaryFocus: `主看变卦《${changedHexagram.hexagram.name}》的整体卦意。`,
    secondaryFocus: extraNote,
    referencedLines: [],
  }
}

function getLineAdvice(position: number, originalValue: CoinLineValue): string {
  return `${POSITION_ADVICE[position]} ${CHANGE_TEXT[originalValue]}`
}

function elementGenerates(from: FiveElement, to: FiveElement): boolean {
  const map: Record<FiveElement, FiveElement> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
  }

  return map[from] === to
}

function elementControls(from: FiveElement, to: FiveElement): boolean {
  const map: Record<FiveElement, FiveElement> = {
    木: '土',
    火: '金',
    土: '水',
    金: '木',
    水: '火',
  }

  return map[from] === to
}

export function getLineName(position: number): string {
  return LINE_NAMES[position - 1] ?? `第${position}爻`
}

export function getCoinLineValue(faces: CoinFace[]): CoinLineValue {
  const sum = faces.reduce((total, face) => total + (face === 'heads' ? 3 : 2), 0)

  if (sum !== 6 && sum !== 7 && sum !== 8 && sum !== 9) {
    throw new Error('硬币结果非法，三枚硬币的和只能是 6、7、8、9。')
  }

  return sum
}

export function describeCoinLineValue(value: CoinLineValue): string {
  const labelMap: Record<CoinLineValue, string> = {
    6: '老阴',
    7: '少阳',
    8: '少阴',
    9: '老阳',
  }

  return `${value} · ${labelMap[value]}`
}

export function createCoinReading(lineValues: CoinLineValue[]): CoinReadingResult {
  if (lineValues.length !== 6) {
    throw new Error('金钱卦必须完整提供六次投掷结果。')
  }

  // 六爻在这里严格按“从下往上”存储：索引 0 是初爻，索引 5 是上爻。
  const baseLines = lineValues.map((value) => (value === 7 || value === 9 ? 1 : 0)) as BinaryLine[]
  const changedLines = lineValues.map((value, index) => {
    const current = baseLines[index]
    return value === 6 || value === 9 ? flipLine(current) : current
  }) as BinaryLine[]

  const movingLines = lineValues.reduce<MovingLineInfo[]>((result, value, index) => {
    if (value === 6 || value === 9) {
      const position = index + 1
      result.push({
        position,
        name: getLineName(position),
        originalValue: value,
        transformText: CHANGE_TEXT[value],
        advice: getLineAdvice(position, value),
      })
    }

    return result
  }, [])

  const baseHexagram = createHexagramSnapshot(baseLines)
  const changedHexagram = createHexagramSnapshot(changedLines)
  const judgementRule = getCoinJudgementRule(movingLines, baseHexagram, changedHexagram)

  return {
    baseHexagram,
    changedHexagram,
    movingLines,
    movingSummary: getMovingSummary(movingLines),
    judgementRule,
    lineValues,
  }
}

export function getTrigramByNumber(value: number): TrigramInfo {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('梅花易数输入必须是正整数。')
  }

  const normalized = normalizeModulo(Math.trunc(value), 8)
  return TRIGRAM_BY_NUMBER[normalized]
}

export function getFiveElementRelation(
  bodyElement: FiveElement,
  useElement: FiveElement,
): ElementRelation {
  if (bodyElement === useElement) {
    return {
      label: '体用比和',
      description: '体卦与用卦五行同气，表示主客双方节奏一致，事情更容易协调推进。',
    }
  }

  if (elementGenerates(bodyElement, useElement)) {
    return {
      label: '体生用',
      description: '你需要持续输出精力去推动外部局势，能成，但会比较耗神耗力。',
    }
  }

  if (elementGenerates(useElement, bodyElement)) {
    return {
      label: '用生体',
      description: '外部条件正在反哺你，容易得到资源、配合或额外助力。',
    }
  }

  if (elementControls(bodyElement, useElement)) {
    return {
      label: '体克用',
      description: '主导权在你手里，能压住局面，但需要付出决断和执行成本。',
    }
  }

  return {
    label: '用克体',
    description: '外部变量对你形成明显约束，宜先避强攻、重调整与化解。',
  }
}

export function createMeihuaReading(firstNumber: number, secondNumber: number): MeihuaReadingResult {
  if (!Number.isInteger(firstNumber) || !Number.isInteger(secondNumber)) {
    throw new Error('梅花易数需要输入整数。')
  }

  if (firstNumber <= 0 || secondNumber <= 0) {
    throw new Error('梅花易数输入必须大于 0。')
  }

  const upperTrigram = getTrigramByNumber(firstNumber)
  const lowerTrigram = getTrigramByNumber(secondNumber)
  const movingLine = normalizeModulo(firstNumber + secondNumber, 6)
  const baseLines = [...lowerTrigram.lines, ...upperTrigram.lines] as BinaryLine[]
  const changedLines = baseLines.map((line, index) =>
    index + 1 === movingLine ? flipLine(line) : line,
  ) as BinaryLine[]

  // 梅花易数里常见的体用判断方式：
  // 动爻落下卦（1-3）时，下卦为用、上卦为体；
  // 动爻落上卦（4-6）时，上卦为用、下卦为体。
  const bodyTrigram = movingLine <= 3 ? upperTrigram : lowerTrigram
  const useTrigram = movingLine <= 3 ? lowerTrigram : upperTrigram
  const relation = getFiveElementRelation(bodyTrigram.element, useTrigram.element)
  const bodyUseSummary =
    movingLine <= 3
      ? '动爻落在下卦，表示外部事务先动，因此以上卦为体、下卦为用。'
      : '动爻落在上卦，表示外部环境牵动更强，因此以下卦为体、上卦为用。'

  return {
    firstNumber,
    secondNumber,
    upperTrigram,
    lowerTrigram,
    bodyTrigram,
    useTrigram,
    movingLine,
    movingLineName: getLineName(movingLine),
    movingAdvice: POSITION_ADVICE[movingLine],
    baseHexagram: createHexagramSnapshot(baseLines),
    changedHexagram: createHexagramSnapshot(changedLines),
    relation,
    bodyUseSummary,
  }
}
