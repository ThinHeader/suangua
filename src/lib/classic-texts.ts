import classicHexagrams from '../data/classic_hexagrams.json'
import classicLines from '../data/classic_lines.json'
import type {
  CoinJudgementRule,
  CoinReadingResult,
  MeihuaReadingResult,
} from './divination'

interface RawClassicHexagram {
  id: number
  name: string
  gua_ci: string
  image: string
  judgement: string
}

interface RawClassicLine {
  id: string
  hexagram_id: number
  position: number
  yao_name: string
  text: string
  source_text: string
  plain_explanation: string
  source: string
}

export interface ClassicHexagramText {
  id: number
  name: string
  guaCi: string
  image: string
  judgement: string
}

export interface ClassicLineText {
  hexagramId: number
  position: number
  yaoName: string
  text: string
  explanation: string
  source: string
}

export interface ClassicalReadingItem {
  label: string
  sourceName: string
  text: string
  explanation?: string
}

const rawHexagramMap = classicHexagrams as Record<string, RawClassicHexagram>
const rawLineList = classicLines as RawClassicLine[]

// 这里建立“卦名 -> 经典文本”的直接索引，方便界面层按 shortName 即时查找。
const hexagramTextByName = Object.values(rawHexagramMap).reduce<Record<string, ClassicHexagramText>>(
  (result, item) => {
    result[item.name] = {
      id: item.id,
      name: item.name,
      guaCi: item.gua_ci,
      image: item.image,
      judgement: item.judgement,
    }

    return result
  },
  {},
)

// 再按“卦 id + 爻位”建立二级索引，这样可以稳定取到某一卦某一爻的原文与白话解释。
const lineTextByHexagramId = rawLineList.reduce<Record<number, Record<number, ClassicLineText>>>(
  (result, item) => {
    if (!result[item.hexagram_id]) {
      result[item.hexagram_id] = {}
    }

    result[item.hexagram_id][item.position] = {
      hexagramId: item.hexagram_id,
      position: item.position,
      yaoName: item.yao_name,
      text: item.text || item.source_text,
      explanation: item.plain_explanation,
      source: item.source,
    }

    return result
  },
  {},
)

function getClassicHexagramText(name: string): ClassicHexagramText | null {
  return hexagramTextByName[name] ?? null
}

function getClassicLineText(name: string, position: number): ClassicLineText | null {
  const hexagram = getClassicHexagramText(name)

  if (!hexagram) {
    return null
  }

  return lineTextByHexagramId[hexagram.id]?.[position] ?? null
}

function createLineReadingItem(name: string, position: number, label: string): ClassicalReadingItem {
  const line = getClassicLineText(name, position)

  // 经典数据文件目前允许“部分收录”，所以这里不能直接抛错。
  // 当某一卦或某一爻暂时缺原文时，界面继续显示占断结果，并明确提示用户该条经典文本尚未补齐。
  if (!line) {
    return {
      label,
      sourceName: `${name} · 第 ${position} 爻`,
      text: '经典爻辞数据暂缺。',
      explanation: '当前可先参考上方卦象摘要与现代解读，后续补全原文后会自动显示。',
    }
  }

  return {
    label,
    sourceName: `${name} · ${line.yaoName}`,
    text: line.text,
    explanation: line.explanation,
  }
}

function createHexagramReadingItem(name: string, label: string): ClassicalReadingItem {
  const hexagram = getClassicHexagramText(name)

  if (!hexagram) {
    return {
      label,
      sourceName: `${name}卦 · 卦辞`,
      text: '经典卦辞数据暂缺。',
      explanation: '当前可先参考上方卦象摘要与结果解读，后续补全经典数据后会自动显示。',
    }
  }

  return {
    label,
    sourceName: `${name}卦 · 卦辞`,
    text: hexagram.guaCi,
    explanation: hexagram.image,
  }
}

function createSpecialUsageItem(title: string, text: string): ClassicalReadingItem {
  return {
    label: '特别参考',
    sourceName: title,
    text,
  }
}

export function getClassicHexagramTextByName(name: string): ClassicHexagramText | null {
  return getClassicHexagramText(name)
}

export function getCoinClassicalReadingItems(reading: CoinReadingResult): ClassicalReadingItem[] {
  const baseName = reading.baseHexagram.hexagram.shortName
  const changedName = reading.changedHexagram.hexagram.shortName
  const movingLines = [...reading.movingLines].sort((a, b) => a.position - b.position)
  const rule = reading.judgementRule

  switch (rule.title) {
    case '无动爻':
      return [createHexagramReadingItem(baseName, '主看原文')]

    case '一动爻':
      return movingLines.length > 0
        ? [
            createLineReadingItem(baseName, movingLines[0].position, '主看原文'),
            createHexagramReadingItem(changedName, '辅助参考'),
          ]
        : []

    case '二动爻':
      return movingLines.length === 2
        ? [
            createLineReadingItem(baseName, movingLines[1].position, '主看原文'),
            createLineReadingItem(baseName, movingLines[0].position, '兼看原文'),
            createHexagramReadingItem(changedName, '辅助参考'),
          ]
        : []

    case '三动爻':
      return [
        createHexagramReadingItem(baseName, '主看原文'),
        createHexagramReadingItem(changedName, '兼看原文'),
      ]

    case '四动爻':
      return rule.referencedLines.map((position, index) =>
        createLineReadingItem(changedName, position, index === 0 ? '主看原文' : '兼看原文'),
      )

    case '五动爻':
      return rule.referencedLines.length > 0
        ? [createLineReadingItem(changedName, rule.referencedLines[0], '主看原文')]
        : []

    case '六动爻': {
      const items: ClassicalReadingItem[] = [createHexagramReadingItem(changedName, '主看原文')]

      if (baseName === '乾') {
        items.push(createSpecialUsageItem('乾卦 · 用九', '見群龍无首，吉。'))
      } else if (baseName === '坤') {
        items.push(createSpecialUsageItem('坤卦 · 用六', '利永貞。'))
      }

      return items
    }

    default:
      return []
  }
}

export function getRuleFocusedLinePositions(rule: CoinJudgementRule): number[] {
  return rule.referencedLines
}

export function getMeihuaClassicalReadingItems(
  reading: MeihuaReadingResult,
): ClassicalReadingItem[] {
  const baseName = reading.baseHexagram.hexagram.shortName
  const changedName = reading.changedHexagram.hexagram.shortName

  // 梅花易数这里采用网页端更易理解的展示顺序：
  // 先给出本卦卦辞说明当前局势，再给出动爻原文提示变化落点，
  // 最后用变卦卦辞说明事情后续的演化方向。
  return [
    createHexagramReadingItem(baseName, '主看原文'),
    createLineReadingItem(baseName, reading.movingLine, '动爻原文'),
    createHexagramReadingItem(changedName, '变卦参考'),
  ]
}
