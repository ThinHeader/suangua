import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  type ClassicalReadingItem,
  getClassicHexagramTextByName,
  getCoinClassicalReadingItems,
  getMeihuaClassicalReadingItems,
} from './lib/classic-texts'
import {
  createCoinReading,
  createMeihuaReading,
  describeCoinLineValue,
  getCoinLineValue,
  getLineName,
  type CoinFace,
  type CoinReadingResult,
  type HexagramSnapshot,
  type MeihuaReadingResult,
} from './lib/divination'

type Mode = 'coin' | 'meihua'
type ExportTheme = 'dark' | 'paper'
type CoinRow = Array<CoinFace | null>

type SavePickerAcceptType = {
  description?: string
  accept: Record<string, string[]>
}

type SavePickerOptions = {
  suggestedName?: string
  types?: SavePickerAcceptType[]
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: SavePickerOptions) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | string) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

const FACE_OPTIONS: Array<{
  value: CoinFace
  title: string
  subtitle: string
}> = [
  {
    value: 'heads',
    title: '正面',
    subtitle: '记 3',
  },
  {
    value: 'tails',
    title: '反面',
    subtitle: '记 2',
  },
]

const QUESTION_SUGGESTIONS = [
  '这次合作是否适合继续推进？',
  '近期换工作时机如何？',
  '当前项目下一步应先抓什么？',
  '这段关系接下来会如何发展？',
]

function createEmptyCoinBoard(): CoinRow[] {
  // 六次投掷严格按“从下往上”存储。
  // 因此数组第 0 行是初爻，第 5 行是上爻。
  return Array.from({ length: 6 }, () => [null, null, null])
}

function randomCoinFace(): CoinFace {
  return Math.random() >= 0.5 ? 'heads' : 'tails'
}

function createRandomCoinRow(): CoinRow {
  return [randomCoinFace(), randomCoinFace(), randomCoinFace()]
}

function isCoinRowComplete(row: CoinRow): boolean {
  return row.every((face) => face !== null)
}

function getReadingTitle(mode: Mode): string {
  return mode === 'coin' ? '金钱卦占断记录' : '梅花易数占断记录'
}

function getExportThemeLabel(theme: ExportTheme): string {
  return theme === 'dark' ? '夜观版' : '纸张版'
}

function getExportThemeFileKey(theme: ExportTheme): string {
  return theme === 'dark' ? 'night' : 'paper'
}

function formatExportTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  const second = `${date.getSeconds()}`.padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function formatExportFileTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  const second = `${date.getSeconds()}`.padStart(2, '0')

  return `${year}${month}${day}-${hour}${minute}${second}`
}

function getExportCanvasTheme(theme: ExportTheme) {
  if (theme === 'paper') {
    return {
      bgTop: '#f8f0e0',
      bgBottom: '#eee0cb',
      panel: '#fffaf2',
      panelMuted: '#f6ecdd',
      border: 'rgba(111, 77, 42, 0.16)',
      text: '#35261a',
      subtle: 'rgba(69, 46, 29, 0.76)',
      accent: '#8a5b28',
      line: '#6e4f39',
    }
  }

  return {
    bgTop: '#060914',
    bgBottom: '#0c1226',
    panel: 'rgba(255, 255, 255, 0.05)',
    panelMuted: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#f6f1e8',
    subtle: 'rgba(246, 241, 232, 0.78)',
    accent: '#ffd08f',
    line: '#f0e8dc',
  }
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []

  text.split('\n').forEach((rawLine) => {
    if (!rawLine.trim()) {
      lines.push('')
      return
    }

    let currentLine = ''

    for (const char of rawLine) {
      const nextLine = currentLine + char

      if (currentLine && context.measureText(nextLine).width > maxWidth) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = nextLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  })

  return lines
}

function measureCanvasTextBlockHeight(lines: string[], lineHeight: number): number {
  return lines.reduce((total, line) => total + (line ? lineHeight : lineHeight * 0.55), 0)
}

function drawCanvasTextBlock(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
): number {
  let currentY = startY

  lines.forEach((line) => {
    if (!line) {
      currentY += lineHeight * 0.55
      return
    }

    context.fillText(line, x, currentY)
    currentY += lineHeight
  })

  return currentY
}

function buildRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient,
) {
  buildRoundedRectPath(context, x, y, width, height, radius)
  context.fillStyle = fillStyle
  context.fill()
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
) {
  buildRoundedRectPath(context, x, y, width, height, radius)
  context.strokeStyle = strokeStyle
  context.stroke()
}

function drawExportHexagramCard(
  context: CanvasRenderingContext2D,
  theme: ReturnType<typeof getExportCanvasTheme>,
  title: string,
  snapshot: HexagramSnapshot,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  fillRoundedRect(context, x, y, width, height, 26, theme.panelMuted)
  strokeRoundedRect(context, x, y, width, height, 26, theme.border)

  context.fillStyle = theme.accent
  context.font = '600 22px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText(title, x + 24, y + 36)

  context.fillStyle = theme.text
  context.font = '700 34px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText(snapshot.hexagram.name, x + 24, y + 82)

  context.fillStyle = theme.subtle
  context.font = '400 22px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText(
    `${snapshot.upperTrigram.name}${snapshot.upperTrigram.symbol} / ${snapshot.lowerTrigram.name}${snapshot.lowerTrigram.symbol}`,
    x + 24,
    y + 118,
  )

  const lineStartX = x + 24
  const lineWidth = width - 48
  const lineTopY = y + 148
  const lineGap = 16
  const lineHeight = 12

  snapshot.lines
    .slice()
    .reverse()
    .forEach((line, index) => {
      const currentY = lineTopY + index * (lineHeight + lineGap)

      if (line === 1) {
        fillRoundedRect(context, lineStartX, currentY, lineWidth, lineHeight, 999, theme.line)
        return
      }

      const segmentWidth = (lineWidth - 20) / 2
      fillRoundedRect(context, lineStartX, currentY, segmentWidth, lineHeight, 999, theme.line)
      fillRoundedRect(
        context,
        lineStartX + segmentWidth + 20,
        currentY,
        segmentWidth,
        lineHeight,
        999,
        theme.line,
      )
    })
}

function triggerDownload(downloadUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function supportsSaveFilePicker(): boolean {
  return typeof (window as SaveFilePickerWindow).showSaveFilePicker === 'function'
}

async function saveBlobWithPicker(
  fileName: string,
  blob: Blob,
  types: SavePickerAcceptType[],
): Promise<boolean> {
  const saveWindow = window as SaveFilePickerWindow

  if (!saveWindow.showSaveFilePicker) {
    return false
  }

  try {
    const handle = await saveWindow.showSaveFilePicker({
      suggestedName: fileName,
      types,
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch (error) {
    // 用户点取消时不把流程判成真正异常，直接回退浏览器下载即可。
    console.warn('原生另存为未完成，回退到浏览器下载。', error)
    return false
  }
}

function downloadBlobFile(fileName: string, blob: Blob) {
  const downloadUrl = URL.createObjectURL(blob)
  triggerDownload(downloadUrl, fileName)
  URL.revokeObjectURL(downloadUrl)
}

async function downloadTextFile(fileName: string, text: string): Promise<'picker' | 'download'> {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const saved = await saveBlobWithPicker(fileName, blob, [
    {
      description: '文本文件',
      accept: {
        'text/plain': ['.txt'],
      },
    },
  ])

  if (saved) {
    return 'picker'
  }

  downloadBlobFile(fileName, blob)
  return 'download'
}

async function exportReadingAsImage({
  fileName,
  title,
  exportedAt,
  question,
  overviewLine,
  metaItems,
  theme,
  baseHexagram,
  changedHexagram,
  bodyText,
}: {
  fileName: string
  title: string
  exportedAt: string
  question: string
  overviewLine: string
  metaItems: Array<{ label: string; value: string }>
  theme: ExportTheme
  baseHexagram: HexagramSnapshot
  changedHexagram: HexagramSnapshot
  bodyText: string
}): Promise<'picker' | 'download'> {
  const themePalette = getExportCanvasTheme(theme)
  const safeQuestion = question.trim() || '未填写，占断以卦象本身为主。'
  const canvasWidth = 1200
  const outerPadding = 40
  const innerPadding = 28
  const blockGap = 20
  const metaCardGap = 14
  const metaCardHeight = 108
  const hexagramCardHeight = 360
  const summaryWidth = canvasWidth - outerPadding * 2 - innerPadding * 2
  const bodyWidth = summaryWidth

  const measureCanvas = document.createElement('canvas')
  const measureContext = measureCanvas.getContext('2d')

  if (!measureContext) {
    throw new Error('当前浏览器环境不支持 canvas 导出。')
  }

  measureContext.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif'
  const overviewLines = wrapCanvasText(measureContext, overviewLine, summaryWidth)
  const questionLines = wrapCanvasText(measureContext, safeQuestion, summaryWidth)
  const bodyLines = wrapCanvasText(measureContext, bodyText, bodyWidth)

  const metaRows = Math.max(1, Math.ceil(metaItems.length / 2))
  const metaGridHeight = metaRows * metaCardHeight + Math.max(0, metaRows - 1) * metaCardGap
  const overviewHeight = measureCanvasTextBlockHeight(overviewLines, 36)
  const questionHeight = measureCanvasTextBlockHeight(questionLines, 34)
  const bodyHeight = measureCanvasTextBlockHeight(bodyLines, 34)

  const headerHeight = 240 + overviewHeight + Math.max(0, metaGridHeight - metaCardHeight)
  const questionBlockHeight = 68 + questionHeight
  const bodyBlockHeight = 96 + bodyHeight
  const footerHeight = 88
  const canvasHeight =
    outerPadding * 2 +
    headerHeight +
    blockGap +
    questionBlockHeight +
    blockGap +
    hexagramCardHeight +
    blockGap +
    bodyBlockHeight +
    blockGap +
    footerHeight

  const canvas = document.createElement('canvas')
  const scale = Math.max(window.devicePixelRatio || 1, 2)
  canvas.width = Math.ceil(canvasWidth * scale)
  canvas.height = Math.ceil(canvasHeight * scale)

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前浏览器环境不支持 canvas 导出。')
  }

  context.scale(scale, scale)
  context.textBaseline = 'top'

  // 这里改为纯 canvas 绘制，不再把 DOM 包进 foreignObject。
  // 这样导出的每一笔都来自同源脚本绘制，浏览器不会再把画布标记为 tainted。
  const backgroundGradient = context.createLinearGradient(0, 0, 0, canvasHeight)
  backgroundGradient.addColorStop(0, themePalette.bgTop)
  backgroundGradient.addColorStop(1, themePalette.bgBottom)
  context.fillStyle = backgroundGradient
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  let cursorY = outerPadding
  const panelX = outerPadding
  const panelWidth = canvasWidth - outerPadding * 2

  fillRoundedRect(context, panelX, cursorY, panelWidth, headerHeight, 30, themePalette.panel)
  strokeRoundedRect(context, panelX, cursorY, panelWidth, headerHeight, 30, themePalette.border)

  context.fillStyle = themePalette.accent
  context.font = '600 18px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText('周易起卦台', panelX + innerPadding, cursorY + 24)

  context.fillStyle = themePalette.text
  context.font = '700 42px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText(title, panelX + innerPadding, cursorY + 58)

  context.fillStyle = themePalette.subtle
  context.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif'
  drawCanvasTextBlock(context, overviewLines, panelX + innerPadding, cursorY + 122, 36)

  context.fillStyle = themePalette.subtle
  context.font = '400 20px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText(`导出时间：${exportedAt}`, panelX + innerPadding, cursorY + 122 + overviewHeight + 16)

  const metaGridY = cursorY + 122 + overviewHeight + 54
  const metaCardWidth = (panelWidth - innerPadding * 2 - metaCardGap) / 2

  metaItems.forEach((item, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const cardX = panelX + innerPadding + column * (metaCardWidth + metaCardGap)
    const cardY = metaGridY + row * (metaCardHeight + metaCardGap)

    fillRoundedRect(context, cardX, cardY, metaCardWidth, metaCardHeight, 22, themePalette.panelMuted)
    strokeRoundedRect(context, cardX, cardY, metaCardWidth, metaCardHeight, 22, themePalette.border)

    context.fillStyle = themePalette.accent
    context.font = '600 18px "Microsoft YaHei", "PingFang SC", sans-serif'
    context.fillText(item.label, cardX + 20, cardY + 18)

    context.fillStyle = themePalette.text
    context.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif'
    const valueLines = wrapCanvasText(context, item.value, metaCardWidth - 40)
    drawCanvasTextBlock(context, valueLines.slice(0, 2), cardX + 20, cardY + 48, 30)
  })

  cursorY += headerHeight + blockGap

  fillRoundedRect(context, panelX, cursorY, panelWidth, questionBlockHeight, 28, themePalette.panelMuted)
  strokeRoundedRect(context, panelX, cursorY, panelWidth, questionBlockHeight, 28, themePalette.border)

  context.fillStyle = themePalette.accent
  context.font = '600 20px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText('占问事项', panelX + innerPadding, cursorY + 20)

  context.fillStyle = themePalette.text
  context.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif'
  drawCanvasTextBlock(context, questionLines, panelX + innerPadding, cursorY + 54, 34)

  cursorY += questionBlockHeight + blockGap

  const hexagramGap = 16
  const hexagramCardWidth = (panelWidth - hexagramGap) / 2
  drawExportHexagramCard(
    context,
    themePalette,
    '本卦',
    baseHexagram,
    panelX,
    cursorY,
    hexagramCardWidth,
    hexagramCardHeight,
  )
  drawExportHexagramCard(
    context,
    themePalette,
    '变卦',
    changedHexagram,
    panelX + hexagramCardWidth + hexagramGap,
    cursorY,
    hexagramCardWidth,
    hexagramCardHeight,
  )

  cursorY += hexagramCardHeight + blockGap

  fillRoundedRect(context, panelX, cursorY, panelWidth, bodyBlockHeight, 30, themePalette.panel)
  strokeRoundedRect(context, panelX, cursorY, panelWidth, bodyBlockHeight, 30, themePalette.border)

  context.fillStyle = themePalette.accent
  context.font = '600 22px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText('占断全文', panelX + innerPadding, cursorY + 24)

  context.fillStyle = themePalette.text
  context.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif'
  drawCanvasTextBlock(context, bodyLines, panelX + innerPadding, cursorY + 66, 34)

  cursorY += bodyBlockHeight + blockGap

  fillRoundedRect(context, panelX, cursorY, panelWidth, footerHeight, 24, themePalette.panelMuted)
  strokeRoundedRect(context, panelX, cursorY, panelWidth, footerHeight, 24, themePalette.border)

  context.fillStyle = themePalette.accent
  context.font = '600 18px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText('周易起卦台 · 卦单留存', panelX + innerPadding, cursorY + 18)

  context.fillStyle = themePalette.subtle
  context.font = '400 18px "Microsoft YaHei", "PingFang SC", sans-serif'
  context.fillText(
    `主题：${getExportThemeLabel(theme)} · 导出于 ${exportedAt}`,
    panelX + innerPadding,
    cursorY + 46,
  )

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('当前浏览器环境不支持图片导出。'))
        return
      }

      resolve(blob)
    }, 'image/png')
  })

  const saved = await saveBlobWithPicker(fileName, pngBlob, [
    {
      description: 'PNG 图片',
      accept: {
        'image/png': ['.png'],
      },
    },
  ])

  if (saved) {
    return 'picker'
  }

  downloadBlobFile(fileName, pngBlob)
  return 'download'
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function copyTextToClipboard(text: string) {
  // 优先使用现代剪贴板 API；若当前运行环境不支持，再回退到 textarea 方案。
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  fallbackCopyText(text)
}

function formatQuestionText(question: string): string {
  return question.trim() ? `占问事项：${question.trim()}` : '占问事项：未填写，当前为纯卦象解读。'
}

function buildCoinSummary(question: string, reading: CoinReadingResult): string {
  const movingNames =
    reading.movingLines.length > 0
      ? reading.movingLines.map((item) => item.name).join('、')
      : '无动爻'

  return [
    formatQuestionText(question),
    `起卦方式：金钱卦。`,
    `本卦：${reading.baseHexagram.hexagram.name}。${reading.baseHexagram.hexagram.summary}`,
    `动爻情况：${movingNames}。${reading.movingSummary}`,
    `传统取用：${reading.judgementRule.summary}`,
    `当前主看：${reading.judgementRule.primaryFocus}`,
    reading.judgementRule.secondaryFocus
      ? `辅助参考：${reading.judgementRule.secondaryFocus}`
      : '',
    `变卦：${reading.changedHexagram.hexagram.name}。${reading.changedHexagram.hexagram.summary}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildMeihuaSummary(question: string, reading: MeihuaReadingResult): string {
  return [
    formatQuestionText(question),
    `起卦方式：梅花易数。`,
    `本卦：${reading.baseHexagram.hexagram.name}。${reading.baseHexagram.hexagram.summary}`,
    `上下卦：上卦为${reading.upperTrigram.name}${reading.upperTrigram.symbol}，下卦为${reading.lowerTrigram.name}${reading.lowerTrigram.symbol}。`,
    `体用关系：体卦为${reading.bodyTrigram.name}${reading.bodyTrigram.symbol}，用卦为${reading.useTrigram.name}${reading.useTrigram.symbol}，${reading.relation.label}。${reading.relation.description}`,
    `动爻：${reading.movingLineName}。${reading.movingAdvice}`,
    `变卦：${reading.changedHexagram.hexagram.name}。${reading.changedHexagram.hexagram.summary}`,
  ].join('\n')
}

function getClassicalReadingCopyText(items: ClassicalReadingItem[]): string {
  return items
    .map((item) =>
      [item.label, item.sourceName, item.text, item.explanation ? `白话：${item.explanation}` : '']
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
}

function getExportOverviewLine({
  mode,
  coinReading,
  meihuaReading,
}: {
  mode: Mode
  coinReading: CoinReadingResult | null
  meihuaReading: MeihuaReadingResult | null
}): string {
  if (mode === 'coin' && coinReading) {
    const movingSummary =
      coinReading.movingLines.length > 0
        ? coinReading.movingLines.map((item) => item.name).join('、')
        : '无动爻'

    return `本卦 ${coinReading.baseHexagram.hexagram.shortName} · 变卦 ${coinReading.changedHexagram.hexagram.shortName} · 动爻 ${movingSummary}`
  }

  if (mode === 'meihua' && meihuaReading) {
    return `本卦 ${meihuaReading.baseHexagram.hexagram.shortName} · 变卦 ${meihuaReading.changedHexagram.hexagram.shortName} · 体${meihuaReading.bodyTrigram.name}${meihuaReading.bodyTrigram.symbol} 用${meihuaReading.useTrigram.name}${meihuaReading.useTrigram.symbol}`
  }

  return ''
}

function getExportMetaItems({
  mode,
  coinReading,
  meihuaReading,
}: {
  mode: Mode
  coinReading: CoinReadingResult | null
  meihuaReading: MeihuaReadingResult | null
}): Array<{ label: string; value: string }> {
  if (mode === 'coin' && coinReading) {
    return [
      { label: '起卦方式', value: '金钱卦' },
      { label: '本卦', value: coinReading.baseHexagram.hexagram.name },
      { label: '变卦', value: coinReading.changedHexagram.hexagram.name },
      {
        label: '动爻',
        value:
          coinReading.movingLines.length > 0
            ? coinReading.movingLines.map((item) => item.name).join('、')
            : '无动爻',
      },
      { label: '取用规则', value: coinReading.judgementRule.title },
      { label: '主看', value: coinReading.judgementRule.primaryFocus },
    ]
  }

  if (mode === 'meihua' && meihuaReading) {
    return [
      { label: '起卦方式', value: '梅花易数' },
      { label: '本卦', value: meihuaReading.baseHexagram.hexagram.name },
      { label: '变卦', value: meihuaReading.changedHexagram.hexagram.name },
      {
        label: '上下卦',
        value: `${meihuaReading.upperTrigram.name}${meihuaReading.upperTrigram.symbol} / ${meihuaReading.lowerTrigram.name}${meihuaReading.lowerTrigram.symbol}`,
      },
      {
        label: '体用',
        value: `体${meihuaReading.bodyTrigram.name}${meihuaReading.bodyTrigram.symbol} / 用${meihuaReading.useTrigram.name}${meihuaReading.useTrigram.symbol}`,
      },
      {
        label: '动爻',
        value: `${meihuaReading.movingLineName}，${meihuaReading.relation.label}`,
      },
    ]
  }

  return []
}

function buildExportTextDocument({
  mode,
  question,
  coinReading,
  meihuaReading,
  exportedAt,
  exportTheme,
}: {
  mode: Mode
  question: string
  coinReading: CoinReadingResult | null
  meihuaReading: MeihuaReadingResult | null
  exportedAt: string
  exportTheme: ExportTheme
}): string {
  if (mode === 'coin' && coinReading) {
    return [
      getReadingTitle(mode),
      `导出时间：${exportedAt}`,
      `导出主题：${getExportThemeLabel(exportTheme)}`,
      getExportOverviewLine({ mode, coinReading, meihuaReading }),
      buildCoinSummary(question, coinReading),
      '',
      '【当前应读原文】',
      getClassicalReadingCopyText(getCoinClassicalReadingItems(coinReading)),
    ].join('\n')
  }

  if (mode === 'meihua' && meihuaReading) {
    return [
      getReadingTitle(mode),
      `导出时间：${exportedAt}`,
      `导出主题：${getExportThemeLabel(exportTheme)}`,
      getExportOverviewLine({ mode, coinReading, meihuaReading }),
      buildMeihuaSummary(question, meihuaReading),
      '',
      '【当前应读原文】',
      getClassicalReadingCopyText(getMeihuaClassicalReadingItems(meihuaReading)),
    ].join('\n')
  }

  return ''
}

function CopyButton({
  onCopy,
  copied,
}: {
  onCopy: () => void
  copied: boolean
}) {
  return (
    <button type="button" className={copied ? 'copy-button is-copied' : 'copy-button'} onClick={onCopy}>
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function ActionButton({
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={active ? 'action-button is-active' : 'action-button'}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

function StepCard({
  step,
  title,
  description,
  state,
}: {
  step: string
  title: string
  description: string
  state: 'done' | 'current' | 'upcoming'
}) {
  return (
    <article className={`step-card is-${state}`}>
      <div className="step-card-index">{step}</div>
      <div className="step-card-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span className="step-card-state">
        {state === 'done' ? '已完成' : state === 'current' ? '进行中' : '待开始'}
      </span>
    </article>
  )
}

function ResultOverviewSection({
  mode,
  coinReading,
  meihuaReading,
}: {
  mode: Mode
  coinReading: CoinReadingResult | null
  meihuaReading: MeihuaReadingResult | null
}) {
  const items = (() => {
    if (mode === 'coin' && coinReading) {
      return [
        { label: '本卦', value: coinReading.baseHexagram.hexagram.shortName, detail: coinReading.baseHexagram.hexagram.summary },
        {
          label: '动爻',
          value:
            coinReading.movingLines.length > 0
              ? coinReading.movingLines.map((item) => item.name).join('、')
              : '无动爻',
          detail: coinReading.judgementRule.title,
        },
        { label: '主看', value: coinReading.judgementRule.primaryFocus, detail: coinReading.judgementRule.summary },
        { label: '变卦', value: coinReading.changedHexagram.hexagram.shortName, detail: coinReading.changedHexagram.hexagram.summary },
      ]
    }

    if (mode === 'meihua' && meihuaReading) {
      return [
        { label: '本卦', value: meihuaReading.baseHexagram.hexagram.shortName, detail: meihuaReading.baseHexagram.hexagram.summary },
        {
          label: '体用',
          value: `体${meihuaReading.bodyTrigram.name}${meihuaReading.bodyTrigram.symbol} / 用${meihuaReading.useTrigram.name}${meihuaReading.useTrigram.symbol}`,
          detail: meihuaReading.bodyUseSummary,
        },
        { label: '关系', value: meihuaReading.relation.label, detail: meihuaReading.relation.description },
        { label: '变卦', value: meihuaReading.changedHexagram.hexagram.shortName, detail: meihuaReading.changedHexagram.hexagram.summary },
      ]
    }

    return []
  })()

  if (items.length === 0) {
    return null
  }

  return (
    <section className="overview-grid" aria-label="结果概览">
      {items.map((item) => (
        <article className="overview-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
    </section>
  )
}

function ClassicalReadingSection({
  title,
  items,
  onCopy,
  copied,
}: {
  title: string
  items: ClassicalReadingItem[]
  onCopy: () => void
  copied: boolean
}) {
  return (
    <section className="result-card">
      <div className="result-card-head">
        <div>
          <p className="result-label">当前应读原文</p>
          <h3>{title}</h3>
        </div>
        <div className="card-actions">
          <span className="summary-chip">{`${items.length} 条参考`}</span>
          <CopyButton onCopy={onCopy} copied={copied} />
        </div>
      </div>

      <div className="classic-reading-list">
        {items.map((item) => (
          <article className="classic-reading-item" key={`${item.label}-${item.sourceName}`}>
            <div className="moving-item-head">
              <strong>{item.label}</strong>
              <span>{item.sourceName}</span>
            </div>
            <p className="classic-raw-text">{item.text}</p>
            {item.explanation ? <p>{item.explanation}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function HexagramFigure({
  snapshot,
  highlightPositions = [],
}: {
  snapshot: HexagramSnapshot
  highlightPositions?: number[]
}) {
  const highlightSet = new Set(highlightPositions)

  return (
    <div className="hexagram-figure" aria-label={`${snapshot.hexagram.name} 卦形`}>
      {snapshot.lines
        .slice()
        .reverse()
        .map((line, index) => {
          const position = 6 - index
          const isHighlight = highlightSet.has(position)

          return (
            <div className="hexagram-line-row" key={`${snapshot.hexagram.key}-${position}`}>
              <span className="hexagram-line-name">{getLineName(position)}</span>
              <div
                className={`hexagram-line ${line === 1 ? 'is-yang' : 'is-yin'} ${
                  isHighlight ? 'is-highlight' : ''
                }`}
              >
                {line === 1 ? (
                  <span className="line-full" />
                ) : (
                  <>
                    <span className="line-half" />
                    <span className="line-gap" />
                    <span className="line-half" />
                  </>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}

function HexagramPanel({
  title,
  snapshot,
  description,
  highlightPositions = [],
  onCopyClassic,
  classicCopied,
}: {
  title: string
  snapshot: HexagramSnapshot
  description: string
  highlightPositions?: number[]
  onCopyClassic?: () => void
  classicCopied?: boolean
}) {
  const classicText = getClassicHexagramTextByName(snapshot.hexagram.shortName)

  return (
    <section className="result-card">
      <div className="result-card-head">
        <div>
          <p className="result-label">{title}</p>
          <h3>{snapshot.hexagram.name}</h3>
        </div>
        <div className="trigram-pair">
          <span>{snapshot.upperTrigram.name + snapshot.upperTrigram.symbol}</span>
          <span>{snapshot.lowerTrigram.name + snapshot.lowerTrigram.symbol}</span>
        </div>
      </div>

      <div className="hexagram-panel-body">
        <HexagramFigure snapshot={snapshot} highlightPositions={highlightPositions} />
        <div className="hexagram-copy">
          <p className="judgement">{snapshot.hexagram.judgement}</p>
          <p>{snapshot.hexagram.summary}</p>
          {classicText ? (
            <div className="classic-quote">
              <div className="classic-quote-head">
                <strong>{`${snapshot.hexagram.shortName}卦原文`}</strong>
                {onCopyClassic ? <CopyButton onCopy={onCopyClassic} copied={Boolean(classicCopied)} /> : null}
              </div>
              <p>{classicText.guaCi}</p>
              <p className="subtle-text">{classicText.image}</p>
            </div>
          ) : null}
          <p className="subtle-text">{description}</p>
        </div>
      </div>
    </section>
  )
}

function CoinResultView({
  reading,
  onCopyClassics,
  classicsCopied,
  onCopyBaseClassic,
  baseClassicCopied,
  onCopyChangedClassic,
  changedClassicCopied,
}: {
  reading: CoinReadingResult
  onCopyClassics: () => void
  classicsCopied: boolean
  onCopyBaseClassic: () => void
  baseClassicCopied: boolean
  onCopyChangedClassic: () => void
  changedClassicCopied: boolean
}) {
  const movingPositions = reading.movingLines.map((item) => item.position)
  const rulePositions = reading.judgementRule.referencedLines
  const classicalItems = getCoinClassicalReadingItems(reading)

  return (
    <>
      <HexagramPanel
        title="本卦"
        snapshot={reading.baseHexagram}
        description="金钱卦以六次投掷形成当前卦象，先看本卦所示的大方向。"
        highlightPositions={Array.from(new Set([...movingPositions, ...rulePositions]))}
        onCopyClassic={onCopyBaseClassic}
        classicCopied={baseClassicCopied}
      />

      <section className="result-card">
        <div className="result-card-head">
          <div>
            <p className="result-label">动爻解读</p>
            <h3>变化落点</h3>
          </div>
          <span className="summary-chip">{reading.movingLines.length} 处变化</span>
        </div>

        <p className="subtle-text">{reading.movingSummary}</p>

        {reading.movingLines.length === 0 ? (
          <div className="note-box">
            <strong>静卦提示</strong>
            <p>本次没有动爻，说明重点在于认清现状、顺着本卦之意去处理事情。</p>
          </div>
        ) : (
          <div className="moving-list">
            {reading.movingLines.map((item) => (
              <article className="moving-item" key={`moving-${item.position}`}>
                <div className="moving-item-head">
                  <strong>{item.name}</strong>
                  <span>{describeCoinLineValue(item.originalValue)}</span>
                </div>
                <p className="moving-transform">{item.transformText}</p>
                <p>{item.advice}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="result-card">
        <div className="result-card-head">
          <div>
            <p className="result-label">传统取用规则</p>
            <h3>{reading.judgementRule.title}</h3>
          </div>
          <span className="summary-chip">严格按动爻数量断</span>
        </div>

        <div className="note-stack">
          <div className="note-box">
            <strong>主判规则</strong>
            <p>{reading.judgementRule.summary}</p>
          </div>
          <div className="note-box">
            <strong>当前主看</strong>
            <p>{reading.judgementRule.primaryFocus}</p>
          </div>
          {reading.judgementRule.secondaryFocus ? (
            <div className="note-box">
              <strong>辅助参考</strong>
              <p>{reading.judgementRule.secondaryFocus}</p>
            </div>
          ) : null}
        </div>
      </section>

      <ClassicalReadingSection
        title="经典卦辞与爻辞"
        items={classicalItems}
        onCopy={onCopyClassics}
        copied={classicsCopied}
      />

      <HexagramPanel
        title="变卦"
        snapshot={reading.changedHexagram}
        description="动爻翻转后形成的变卦，代表事情继续演化后的趋势与落点。"
        highlightPositions={reading.judgementRule.title === '四动爻' || reading.judgementRule.title === '五动爻'
          ? rulePositions
          : []}
        onCopyClassic={onCopyChangedClassic}
        classicCopied={changedClassicCopied}
      />
    </>
  )
}

function MeihuaResultView({
  reading,
  onCopyClassics,
  classicsCopied,
  onCopyBaseClassic,
  baseClassicCopied,
  onCopyChangedClassic,
  changedClassicCopied,
}: {
  reading: MeihuaReadingResult
  onCopyClassics: () => void
  classicsCopied: boolean
  onCopyBaseClassic: () => void
  baseClassicCopied: boolean
  onCopyChangedClassic: () => void
  changedClassicCopied: boolean
}) {
  const classicalItems = getMeihuaClassicalReadingItems(reading)

  return (
    <>
      <section className="result-card">
        <div className="result-card-head">
          <div>
            <p className="result-label">梅花易数</p>
            <h3>体用与五行</h3>
          </div>
          <span className="summary-chip">{reading.relation.label}</span>
        </div>

        <div className="facts-grid">
          <article className="fact-box">
            <span className="fact-label">上卦</span>
            <strong>{`${reading.upperTrigram.name}${reading.upperTrigram.symbol}`}</strong>
            <p>{reading.upperTrigram.nature}</p>
          </article>
          <article className="fact-box">
            <span className="fact-label">下卦</span>
            <strong>{`${reading.lowerTrigram.name}${reading.lowerTrigram.symbol}`}</strong>
            <p>{reading.lowerTrigram.nature}</p>
          </article>
          <article className="fact-box">
            <span className="fact-label">体卦</span>
            <strong>{`${reading.bodyTrigram.name}${reading.bodyTrigram.symbol}`}</strong>
            <p>{`${reading.bodyTrigram.element}行，${reading.bodyTrigram.nature}`}</p>
          </article>
          <article className="fact-box">
            <span className="fact-label">用卦</span>
            <strong>{`${reading.useTrigram.name}${reading.useTrigram.symbol}`}</strong>
            <p>{`${reading.useTrigram.element}行，${reading.useTrigram.nature}`}</p>
          </article>
        </div>

        <div className="note-stack">
          <div className="note-box">
            <strong>{`${reading.movingLineName}动`}</strong>
            <p>{reading.movingAdvice}</p>
          </div>
          <div className="note-box">
            <strong>体用判断</strong>
            <p>{reading.bodyUseSummary}</p>
          </div>
          <div className="note-box">
            <strong>{reading.relation.label}</strong>
            <p>{reading.relation.description}</p>
          </div>
        </div>
      </section>

      <ClassicalReadingSection
        title="梅花易数经典参考"
        items={classicalItems}
        onCopy={onCopyClassics}
        copied={classicsCopied}
      />

      <HexagramPanel
        title="本卦"
        snapshot={reading.baseHexagram}
        description="前一个数字取上卦、后一个数字取下卦，先看当前态势与主问题。"
        highlightPositions={[reading.movingLine]}
        onCopyClassic={onCopyBaseClassic}
        classicCopied={baseClassicCopied}
      />

      <HexagramPanel
        title="变卦"
        snapshot={reading.changedHexagram}
        description="按动爻翻转后得到的变卦，更像事情后续的变化方向。"
        onCopyClassic={onCopyChangedClassic}
        classicCopied={changedClassicCopied}
      />
    </>
  )
}

function App() {
  // 页面只保留一个模式开关，避免把两种起卦方式混在一起造成阅读负担。
  const [mode, setMode] = useState<Mode>('coin')

  // 金钱卦状态：每一行代表一爻，每一列代表一枚硬币。
  const [coinBoard, setCoinBoard] = useState<CoinRow[]>(() => createEmptyCoinBoard())

  // 梅花易数状态：保留字符串，方便用户在输入过程中看到原始表单值。
  const [firstNumber, setFirstNumber] = useState('12')
  const [secondNumber, setSecondNumber] = useState('27')
  const [question, setQuestion] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [exportTheme, setExportTheme] = useState<ExportTheme>('dark')
  const [rollingRows, setRollingRows] = useState<number[]>([])
  const [ritualMessage, setRitualMessage] = useState('')
  const [exportNotice, setExportNotice] = useState('')
  const resultPanelRef = useRef<HTMLElement | null>(null)
  const coinRowRefs = useRef<Array<HTMLElement | null>>([])
  const rollingIntervalRef = useRef<number | null>(null)
  const rollingFinishRef = useRef<number | null>(null)
  const ritualMessageRef = useRef<number | null>(null)
  const exportNoticeRef = useRef<number | null>(null)

  const filledCoinRows = coinBoard.filter((row) => row.every(Boolean)).length
  const nextCoinRowIndex = coinBoard.findIndex((row) => !isCoinRowComplete(row))
  const coinCompletionRate = Math.round((filledCoinRows / 6) * 100)

  const coinReadingState = useMemo(() => {
    if (filledCoinRows !== 6) {
      return {
        reading: null as CoinReadingResult | null,
        message: `已完成 ${filledCoinRows} / 6 爻，请继续从下往上选满六次硬币。`,
      }
    }

    try {
      const lineValues = coinBoard.map((row) => getCoinLineValue(row as CoinFace[]))

      return {
        reading: createCoinReading(lineValues),
        message: '',
      }
    } catch (error) {
      return {
        reading: null as CoinReadingResult | null,
        message: error instanceof Error ? error.message : '金钱卦计算失败，请检查输入。',
      }
    }
  }, [coinBoard, filledCoinRows])

  const meihuaReadingState = useMemo(() => {
    const parsedFirst = Number(firstNumber)
    const parsedSecond = Number(secondNumber)

    if (!firstNumber || !secondNumber) {
      return {
        reading: null as MeihuaReadingResult | null,
        message: '请输入两个正整数，系统会自动换算上下卦与动爻。',
      }
    }

    try {
      return {
        reading: createMeihuaReading(parsedFirst, parsedSecond),
        message: '',
      }
    } catch (error) {
      return {
        reading: null as MeihuaReadingResult | null,
        message: error instanceof Error ? error.message : '梅花易数计算失败，请检查输入。',
      }
    }
  }, [firstNumber, secondNumber])

  const summaryText = useMemo(() => {
    if (mode === 'coin' && coinReadingState.reading) {
      return buildCoinSummary(question, coinReadingState.reading)
    }

    if (mode === 'meihua' && meihuaReadingState.reading) {
      return buildMeihuaSummary(question, meihuaReadingState.reading)
    }

    return ''
  }, [coinReadingState.reading, meihuaReadingState.reading, mode, question])

  const isRolling = rollingRows.length > 0
  const resultReady = mode === 'coin' ? Boolean(coinReadingState.reading) : Boolean(meihuaReadingState.reading)
  const resultStatusLabel = resultReady ? '结果已生成' : mode === 'coin' ? '等待六爻完成' : '等待数字换算'
  const resultStatusDescription = resultReady
    ? '现在可以复制摘要、阅读原文，或导出文本与图片。'
    : mode === 'coin'
      ? `还差 ${Math.max(0, 6 - filledCoinRows)} 爻，建议按顺序继续录入。`
      : '输入两个正整数后，会自动得到体用、五行关系与变卦。'
  const questionCount = question.trim().length
  const workflowStepState = {
    chooseMode: 'done' as const,
    enterData: resultReady ? ('done' as const) : ('current' as const),
    readResult: resultReady ? ('current' as const) : ('upcoming' as const),
  }

  useEffect(() => {
    return () => {
      if (rollingIntervalRef.current !== null) {
        window.clearInterval(rollingIntervalRef.current)
      }

      if (rollingFinishRef.current !== null) {
        window.clearTimeout(rollingFinishRef.current)
      }

      if (ritualMessageRef.current !== null) {
        window.clearTimeout(ritualMessageRef.current)
      }

      if (exportNoticeRef.current !== null) {
        window.clearTimeout(exportNoticeRef.current)
      }
    }
  }, [])

  function clearRitualMessageTimer() {
    if (ritualMessageRef.current !== null) {
      window.clearTimeout(ritualMessageRef.current)
      ritualMessageRef.current = null
    }
  }

  function setTemporaryRitualMessage(message: string, duration = 1800) {
    setRitualMessage(message)
    clearRitualMessageTimer()
    ritualMessageRef.current = window.setTimeout(() => {
      setRitualMessage('')
      ritualMessageRef.current = null
    }, duration)
  }

  function clearExportNoticeTimer() {
    if (exportNoticeRef.current !== null) {
      window.clearTimeout(exportNoticeRef.current)
      exportNoticeRef.current = null
    }
  }

  function setTemporaryExportNotice(message: string, duration = 3200) {
    setExportNotice(message)
    clearExportNoticeTimer()
    exportNoticeRef.current = window.setTimeout(() => {
      setExportNotice('')
      exportNoticeRef.current = null
    }, duration)
  }

  function stopCoinRitual() {
    if (rollingIntervalRef.current !== null) {
      window.clearInterval(rollingIntervalRef.current)
      rollingIntervalRef.current = null
    }

    if (rollingFinishRef.current !== null) {
      window.clearTimeout(rollingFinishRef.current)
      rollingFinishRef.current = null
    }

    setRollingRows([])
  }

  function startCoinRitual(targetRows: number[], finalBoard: CoinRow[], ritualText: string) {
    stopCoinRitual()
    setRollingRows(targetRows)
    setRitualMessage(ritualText)

    // 动画阶段持续快速改写目标行，让按钮状态看起来像真实翻币。
    // 时间结束后再一次性落到最终卦象，避免中途抖动造成“结果不确定”的观感。
    rollingIntervalRef.current = window.setInterval(() => {
      setCoinBoard((current) =>
        current.map((row, index) => (targetRows.includes(index) ? createRandomCoinRow() : row)),
      )
    }, 90)

    rollingFinishRef.current = window.setTimeout(() => {
      if (rollingIntervalRef.current !== null) {
        window.clearInterval(rollingIntervalRef.current)
        rollingIntervalRef.current = null
      }

      setCoinBoard(finalBoard)
      setRollingRows([])
      rollingFinishRef.current = null
      setTemporaryRitualMessage('铜钱已定，卦象已成。')
    }, 980)
  }

  function scrollToCoinRow(rowIndex: number) {
    const target = coinRowRefs.current[rowIndex]

    if (!target) {
      return
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }

  function updateCoinFace(rowIndex: number, coinIndex: number, face: CoinFace) {
    if (isRolling) {
      return
    }

    setCoinBoard((current) => {
      const nextBoard = current.map((row, currentRowIndex) => {
        if (currentRowIndex !== rowIndex) {
          return row
        }

        return row.map((value, currentCoinIndex) =>
          currentCoinIndex === coinIndex ? face : value,
        ) as CoinRow
      })

      // 当前一爻刚好录满时，自动把视线带到下一爻，减少用户来回找位置的成本。
      // 这里不强制跳转到顶部，只滚到相邻目标附近，让桌面和移动端都更自然。
      if (isCoinRowComplete(nextBoard[rowIndex])) {
        const nextIncompleteIndex = nextBoard.findIndex(
          (row, currentRowIndex) => currentRowIndex > rowIndex && !isCoinRowComplete(row),
        )

        if (nextIncompleteIndex !== -1) {
          window.setTimeout(() => {
            scrollToCoinRow(nextIncompleteIndex)
          }, 140)
        }
      }

      return nextBoard
    })
  }

  function resetCoinBoard() {
    stopCoinRitual()
    clearRitualMessageTimer()
    setRitualMessage('')
    setCoinBoard(createEmptyCoinBoard())
  }

  function randomizeAllCoinRows() {
    startCoinRitual(
      [0, 1, 2, 3, 4, 5],
      Array.from({ length: 6 }, () => createRandomCoinRow()),
      '六爻铜钱翻转中，请稍候定卦……',
    )
  }

  function fillRemainingCoinRows() {
    const targetRows = coinBoard
      .map((row, index) => (isCoinRowComplete(row) ? null : index))
      .filter((value): value is number => value !== null)

    if (targetRows.length === 0) {
      setTemporaryRitualMessage('六爻已经齐全，可直接观卦。')
      return
    }

    startCoinRitual(
      targetRows,
      coinBoard.map((row) => (isCoinRowComplete(row) ? row : createRandomCoinRow())),
      '未定之爻翻转中，正在补齐卦象……',
    )
  }

  function randomizeCoinRow(rowIndex: number) {
    startCoinRitual(
      [rowIndex],
      coinBoard.map((row, currentIndex) => (currentIndex === rowIndex ? createRandomCoinRow() : row)),
      `${getLineName(rowIndex + 1)}铜钱翻转中……`,
    )
  }

  async function handleCopy(copyId: string, text: string) {
    if (!text.trim()) {
      return
    }

    try {
      await copyTextToClipboard(text)
      setCopiedKey(copyId)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === copyId ? '' : current))
      }, 1800)
    } catch (error) {
      console.error('复制失败', error)
    }
  }

  async function handleExportText() {
    if (isRolling) {
      setTemporaryRitualMessage('请等待铜钱落定后再导出。')
      return
    }

    const exportDate = new Date()
    const exportedAt = formatExportTimestamp(exportDate)
    const fileStamp = formatExportFileTimestamp(exportDate)
    const exportText = buildExportTextDocument({
      mode,
      question,
      coinReading: coinReadingState.reading,
      meihuaReading: meihuaReadingState.reading,
      exportedAt,
      exportTheme,
    })

    if (!exportText.trim()) {
      return
    }

    setBusyAction('export-text')

    try {
      const fileName = `suangua-${mode === 'coin' ? 'jinqiangua' : 'meihuayishu'}-${getExportThemeFileKey(exportTheme)}-${fileStamp}.txt`
      const saveMethod = await downloadTextFile(fileName, exportText)
      setTemporaryExportNotice(
        saveMethod === 'picker'
          ? `已打开“另存为”窗口，请确认保存位置：${fileName}`
          : `当前浏览器未提供“另存为”，文件已下载到默认下载目录：${fileName}`,
      )
    } finally {
      window.setTimeout(() => setBusyAction(''), 800)
    }
  }

  async function handleExportImage() {
    if (!resultPanelRef.current) {
      return
    }

    if (isRolling) {
      setTemporaryRitualMessage('请等待铜钱落定后再导出。')
      return
    }

    setBusyAction('export-image')

    try {
      const exportDate = new Date()
      const exportedAt = formatExportTimestamp(exportDate)
      const fileStamp = formatExportFileTimestamp(exportDate)
      const baseHexagram = mode === 'coin'
        ? coinReadingState.reading?.baseHexagram
        : meihuaReadingState.reading?.baseHexagram
      const changedHexagram = mode === 'coin'
        ? coinReadingState.reading?.changedHexagram
        : meihuaReadingState.reading?.changedHexagram

      if (!baseHexagram || !changedHexagram) {
        return
      }

      const exportText = buildExportTextDocument({
        mode,
        question,
        coinReading: coinReadingState.reading,
        meihuaReading: meihuaReadingState.reading,
        exportedAt,
        exportTheme,
      })

      if (!exportText.trim()) {
        return
      }

      const fileName = `suangua-${mode === 'coin' ? 'jinqiangua' : 'meihuayishu'}-${getExportThemeFileKey(exportTheme)}-${fileStamp}.png`
      const saveMethod = await exportReadingAsImage({
        fileName,
        title: getReadingTitle(mode),
        exportedAt,
        question,
        overviewLine: getExportOverviewLine({
          mode,
          coinReading: coinReadingState.reading,
          meihuaReading: meihuaReadingState.reading,
        }),
        metaItems: getExportMetaItems({
          mode,
          coinReading: coinReadingState.reading,
          meihuaReading: meihuaReadingState.reading,
        }),
        theme: exportTheme,
        baseHexagram,
        changedHexagram,
        bodyText: exportText,
      })
      setTemporaryExportNotice(
        saveMethod === 'picker'
          ? `已打开“另存为”窗口，请确认保存位置：${fileName}`
          : `当前浏览器未提供“另存为”，图片已下载到默认下载目录：${fileName}`,
      )
    } catch (error) {
      console.error('导出图片失败', error)
      setTemporaryExportNotice('导出图片失败，请稍后重试。')
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">周易起卦台</p>
          <h1>金钱卦与梅花易数，一页内完成起卦与解读</h1>
          <p className="hero-text">
            金钱卦适合逐爻起局，能看到本卦、动爻与变卦的层层演化；梅花易数适合数字速断，自动换算体用、五行生克与变卦走势。
          </p>
        </div>

        <div className="hero-side">
          <div className="hero-highlights">
            <span>双模式切换</span>
            <span>六爻动态展示</span>
            <span>体用五行分析</span>
            <span>移动端自适应</span>
          </div>

          <div className="hero-insight-card">
            <span>当前流程</span>
            <strong>{mode === 'coin' ? '逐爻起卦，先成象后观变' : '双数起卦，快速看体用关系'}</strong>
            <p>
              {mode === 'coin'
                ? `已经完成 ${filledCoinRows} / 6 爻，结果区会在录满后即时展开。`
                : '输入两个数字后，右侧会立即给出本卦、体用、五行与变卦。'}
            </p>
          </div>
        </div>
      </header>

      <section className="mode-panel">
        <div className="mode-copy">
          <p className="eyebrow">起卦方式</p>
          <h2>选择你的起卦入口</h2>
        </div>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'coin' ? 'mode-button is-active' : 'mode-button'}
            onClick={() => setMode('coin')}
          >
            <strong>金钱卦</strong>
            <span>六次投掷，逐爻成卦</span>
          </button>
          <button
            type="button"
            className={mode === 'meihua' ? 'mode-button is-active' : 'mode-button'}
            onClick={() => setMode('meihua')}
          >
            <strong>梅花易数</strong>
            <span>双数字起卦，快速速断</span>
          </button>
        </div>

        <div className="mode-notes">
          <article className="mode-note-card">
            <strong>金钱卦适合</strong>
            <p>想细看每一爻的变化过程，适合需要逐步推演的情境。</p>
          </article>
          <article className="mode-note-card">
            <strong>梅花易数适合</strong>
            <p>想快速得到方向判断，适合先看体用强弱与后续走势。</p>
          </article>
        </div>
      </section>

      <main className="workspace">
        <section className="input-panel">
          <section className="workflow-steps" aria-label="使用步骤">
            <StepCard
              step="01"
              title="选择起卦方式"
              description="根据你的问题场景，决定是逐爻起卦还是快速速断。"
              state={workflowStepState.chooseMode}
            />
            <StepCard
              step="02"
              title={mode === 'coin' ? '录入六爻信息' : '输入两个数字'}
              description={
                mode === 'coin'
                  ? '从下往上依次完成六爻，系统会自动换算本卦与动爻。'
                  : '输入两个正整数后，系统会自动换算上下卦、动爻与体用。'
              }
              state={workflowStepState.enterData}
            />
            <StepCard
              step="03"
              title="查看结果并导出"
              description="生成后可直接复制摘要，也可导出文本或图片留存。"
              state={workflowStepState.readResult}
            />
          </section>

          {mode === 'coin' ? (
            <>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">金钱卦录入</p>
                  <h2>请从下往上选择六次三枚硬币</h2>
                </div>
                <div className="card-actions">
                  <ActionButton
                    label={isRolling && rollingRows.length === 6 ? '抛掷中' : '随机六爻'}
                    onClick={randomizeAllCoinRows}
                    active={isRolling && rollingRows.length === 6}
                    disabled={isRolling}
                  />
                  <ActionButton
                    label={isRolling && rollingRows.length !== 6 ? '补齐中' : '随机补齐'}
                    onClick={fillRemainingCoinRows}
                    active={isRolling && rollingRows.length !== 6}
                    disabled={isRolling}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={resetCoinBoard}
                    disabled={busyAction === 'export-image'}
                  >
                    重置六爻
                  </button>
                </div>
              </div>

              <div className="coin-rules">
                <span>规则一：正面记 3，反面记 2</span>
                <span>规则二：6 为老阴，7 为少阳，8 为少阴，9 为老阳</span>
              </div>

              <div className="coin-progress">
                <span>{`当前进度 ${filledCoinRows} / 6`}</span>
                <span>录入顺序：初爻 → 上爻</span>
              </div>

              <section className="progress-card" aria-label="录入进度">
                <div className="progress-card-head">
                  <div>
                    <strong>录入进度</strong>
                    <p>
                      {nextCoinRowIndex === -1
                        ? '六爻已齐，可以直接查看完整结果。'
                        : `下一步建议先完成${getLineName(nextCoinRowIndex + 1)}。`}
                    </p>
                  </div>
                  <span className="summary-chip">{`${coinCompletionRate}%`}</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <span className="progress-fill" style={{ width: `${coinCompletionRate}%` }} />
                </div>
                <div className="line-navigator">
                  {coinBoard.map((row, rowIndex) => {
                    const isComplete = isCoinRowComplete(row)
                    const isCurrent = !isComplete && rowIndex === nextCoinRowIndex

                    return (
                      <button
                        key={`line-nav-${rowIndex + 1}`}
                        type="button"
                        className={[
                          'line-nav-button',
                          isComplete ? 'is-complete' : '',
                          isCurrent ? 'is-current' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => scrollToCoinRow(rowIndex)}
                      >
                        <span>{getLineName(rowIndex + 1)}</span>
                        <strong>{isComplete ? '已定' : isCurrent ? '当前' : '待录入'}</strong>
                      </button>
                    )
                  })}
                </div>
              </section>

              {ritualMessage ? <div className="ritual-banner">{ritualMessage}</div> : null}

              <div className="coin-list">
                {coinBoard.map((row, rowIndex) => {
                  const isComplete = row.every(Boolean)
                  const lineValue = isComplete ? getCoinLineValue(row as CoinFace[]) : null
                  const isRollingRow = rollingRows.includes(rowIndex)

                  return (
                    <article
                      ref={(element) => {
                        coinRowRefs.current[rowIndex] = element
                      }}
                      className={[
                        'coin-row',
                        isComplete ? 'is-complete' : '',
                        isRollingRow ? 'is-rolling' : '',
                        !isComplete && rowIndex === nextCoinRowIndex ? 'is-next' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={`coin-row-${rowIndex + 1}`}
                    >
                      <div className="coin-row-head">
                        <div>
                          <span className="row-order">{`第 ${rowIndex + 1} 爻`}</span>
                          <h3>{getLineName(rowIndex + 1)}</h3>
                        </div>
                        <div className="card-actions">
                          <span className="row-value">
                            {lineValue ? describeCoinLineValue(lineValue) : '等待选择'}
                          </span>
                          <ActionButton
                            label={isRollingRow ? '抛掷中' : '随机本爻'}
                            onClick={() => randomizeCoinRow(rowIndex)}
                            active={isRollingRow}
                            disabled={isRolling}
                          />
                        </div>
                      </div>

                      <div className="coin-row-body">
                        {row.map((face, coinIndex) => (
                          <div className="coin-slot" key={`coin-${rowIndex + 1}-${coinIndex + 1}`}>
                            <span className="coin-slot-label">{`第 ${coinIndex + 1} 枚`}</span>
                            <div className="coin-toggle">
                              {FACE_OPTIONS.map((option) => (
                                <button
                                  type="button"
                                  key={`${rowIndex + 1}-${coinIndex + 1}-${option.value}`}
                                  className={
                                    face === option.value
                                      ? 'coin-face-button is-active'
                                      : 'coin-face-button'
                                  }
                                  disabled={isRolling}
                                  onClick={() => updateCoinFace(rowIndex, coinIndex, option.value)}
                                >
                                  <strong>{option.title}</strong>
                                  <span>{option.subtitle}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">梅花易数录入</p>
                  <h2>输入两个数字，自动换算上下卦与动爻</h2>
                </div>
              </div>

              <div className="number-grid">
                <label className="number-field">
                  <span>第一个数字</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={firstNumber}
                    onChange={(event) => setFirstNumber(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder="例如 12"
                  />
                  <small>取上卦，按 8 取余，余 0 按 8 计。</small>
                </label>

                <label className="number-field">
                  <span>第二个数字</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={secondNumber}
                    onChange={(event) => setSecondNumber(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder="例如 27"
                  />
                  <small>取下卦；两数相加再按 6 取余得到动爻。</small>
                </label>
              </div>

              <div className="number-tips">
                <div className="note-box">
                  <strong>起卦规则</strong>
                  <p>前数取上卦，后数取下卦，二数之和定动爻。</p>
                </div>
                <div className="note-box">
                  <strong>体用判断</strong>
                  <p>动在下卦则上卦为体，动在上卦则下卦为体。</p>
                </div>
              </div>
            </>
          )}

          <section className="question-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">占问事项</p>
                <h2>写下你这次想问的问题</h2>
              </div>
            </div>

            <label className="question-field">
              <span>问题内容</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="例如：这次合作是否适合继续推进？近期换工作时机如何？"
              />
              <div className="question-field-foot">
                <small>不填写也可以，仅按卦象本身输出摘要。</small>
                <span>{`${questionCount} 字`}</span>
              </div>
            </label>

            <div className="question-suggestions">
              {QUESTION_SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={question.trim() === item ? 'question-chip is-active' : 'question-chip'}
                  onClick={() => setQuestion(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className="result-panel" ref={resultPanelRef}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">结果解读</p>
              <h2>{mode === 'coin' ? '本卦、动爻与变卦' : '体用、五行与变卦'}</h2>
              <p className="subtle-text">{`当前导出主题：${getExportThemeLabel(exportTheme)}`}</p>
              <p className="subtle-text">
                {supportsSaveFilePicker() ? '当前浏览器支持“另存为”面板。' : '当前浏览器将使用默认下载目录保存文件。'}
              </p>
            </div>
            <div className="card-actions">
              <ActionButton
                label="夜观版"
                onClick={() => setExportTheme('dark')}
                active={exportTheme === 'dark'}
                disabled={Boolean(busyAction)}
              />
              <ActionButton
                label="纸张版"
                onClick={() => setExportTheme('paper')}
                active={exportTheme === 'paper'}
                disabled={Boolean(busyAction)}
              />
              <ActionButton
                label={busyAction === 'export-text' ? '导出文本中' : '导出文本'}
                onClick={handleExportText}
                active={busyAction === 'export-text'}
                disabled={Boolean(busyAction) || isRolling}
              />
              <ActionButton
                label={busyAction === 'export-image' ? '导出图片中' : '导出图片'}
                onClick={handleExportImage}
                active={busyAction === 'export-image'}
                disabled={Boolean(busyAction) || isRolling}
              />
            </div>
          </div>

          <section className="result-status">
            <div>
              <p className="result-label">当前状态</p>
              <strong>{resultStatusLabel}</strong>
              <p>{resultStatusDescription}</p>
            </div>
            <span className={`status-badge ${resultReady ? 'is-ready' : ''}`}>
              {resultReady ? '可复制 / 可导出' : '等待生成'}
            </span>
          </section>

          {exportNotice ? <div className="notice-banner">{exportNotice}</div> : null}

          <ResultOverviewSection
            mode={mode}
            coinReading={coinReadingState.reading}
            meihuaReading={meihuaReadingState.reading}
          />

          {summaryText ? (
            <section className="result-card">
              <div className="result-card-head">
                <div>
                  <p className="result-label">占断摘要</p>
                  <h3>可直接复制使用</h3>
                </div>
                <div className="card-actions">
                  <span className="summary-chip">{mode === 'coin' ? '金钱卦摘要' : '梅花易数摘要'}</span>
                  <CopyButton
                    onCopy={() => handleCopy('summary', summaryText)}
                    copied={copiedKey === 'summary'}
                  />
                </div>
              </div>

              <pre className="summary-output">{summaryText}</pre>
            </section>
          ) : null}

          {mode === 'coin' ? (
            coinReadingState.reading ? (
              (() => {
                const reading = coinReadingState.reading

                return (
              <CoinResultView
                reading={reading}
                onCopyClassics={() =>
                  handleCopy(
                    'coin-classics',
                    getClassicalReadingCopyText(getCoinClassicalReadingItems(reading)),
                  )
                }
                classicsCopied={copiedKey === 'coin-classics'}
                onCopyBaseClassic={() =>
                  handleCopy(
                    'coin-base-classic',
                    getClassicHexagramTextByName(reading.baseHexagram.hexagram.shortName)?.guaCi ?? '',
                  )
                }
                baseClassicCopied={copiedKey === 'coin-base-classic'}
                onCopyChangedClassic={() =>
                  handleCopy(
                    'coin-changed-classic',
                    getClassicHexagramTextByName(reading.changedHexagram.hexagram.shortName)?.guaCi ?? '',
                  )
                }
                changedClassicCopied={copiedKey === 'coin-changed-classic'}
              />
                )
              })()
            ) : (
              <div className="empty-state">
                <strong>等待六爻录入完成</strong>
                <p>{coinReadingState.message}</p>
                <div className="empty-state-tips">
                  <span>1. 先从初爻开始选择三枚硬币</span>
                  <span>2. 每录满一爻，页面会自动提示下一步</span>
                  <span>3. 六爻完成后，右侧会立即展开本卦与动爻解读</span>
                </div>
              </div>
            )
          ) : meihuaReadingState.reading ? (
            (() => {
              const reading = meihuaReadingState.reading

              return (
            <MeihuaResultView
              reading={reading}
              onCopyClassics={() =>
                handleCopy(
                  'meihua-classics',
                  getClassicalReadingCopyText(getMeihuaClassicalReadingItems(reading)),
                )
              }
              classicsCopied={copiedKey === 'meihua-classics'}
              onCopyBaseClassic={() =>
                handleCopy(
                  'meihua-base-classic',
                  getClassicHexagramTextByName(reading.baseHexagram.hexagram.shortName)?.guaCi ?? '',
                )
              }
              baseClassicCopied={copiedKey === 'meihua-base-classic'}
              onCopyChangedClassic={() =>
                handleCopy(
                  'meihua-changed-classic',
                  getClassicHexagramTextByName(reading.changedHexagram.hexagram.shortName)?.guaCi ?? '',
                )
              }
              changedClassicCopied={copiedKey === 'meihua-changed-classic'}
            />
              )
            })()
          ) : (
            <div className="empty-state">
              <strong>等待数字输入</strong>
              <p>{meihuaReadingState.message}</p>
              <div className="empty-state-tips">
                <span>1. 第一个数字决定上卦</span>
                <span>2. 第二个数字决定下卦</span>
                <span>3. 两数相加后自动换算动爻与体用</span>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}

export default App
