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

function getExportThemeConfig(theme: ExportTheme) {
  if (theme === 'paper') {
    return {
      wrapperBackground:
        'linear-gradient(180deg, rgb(248, 240, 224) 0%, rgb(240, 230, 210) 100%)',
      wrapperColor: '#35261a',
      headerBackground:
        'radial-gradient(circle at top right, rgba(182, 118, 54, 0.18), transparent 35%), rgba(255, 252, 246, 0.92)',
      headerBorder: '1px solid rgba(111, 77, 42, 0.18)',
      eyebrowColor: '#8a5b28',
      overviewColor: '#4e3521',
      metaColor: 'rgba(69, 46, 29, 0.72)',
      panelBackground: 'rgba(255, 251, 245, 0.92)',
      panelBorder: '1px solid rgba(111, 77, 42, 0.14)',
      panelMutedBackground: 'rgba(248, 241, 231, 0.96)',
      panelMutedBorder: '1px solid rgba(111, 77, 42, 0.12)',
      accentColor: '#8a5b28',
      lineColor: 'linear-gradient(90deg, #57402f, #7b5c44)',
      lineShadow: 'none',
    }
  }

  return {
    wrapperBackground: 'linear-gradient(180deg, rgb(6, 9, 20) 0%, rgb(11, 16, 32) 100%)',
    wrapperColor: '#f6f1e8',
    headerBackground:
      'radial-gradient(circle at top right, rgba(255, 170, 96, 0.18), transparent 35%), rgba(255, 255, 255, 0.04)',
    headerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    eyebrowColor: '#ffd08f',
    overviewColor: '#fff4df',
    metaColor: 'rgba(246, 241, 232, 0.78)',
    panelBackground: 'rgba(255, 255, 255, 0.04)',
    panelBorder: '1px solid rgba(255, 255, 255, 0.08)',
    panelMutedBackground: 'rgba(255, 255, 255, 0.04)',
    panelMutedBorder: '1px solid rgba(255, 255, 255, 0.08)',
    accentColor: '#ffd08f',
    lineColor: 'linear-gradient(90deg, rgba(230, 234, 255, 0.95), rgba(165, 180, 255, 0.88))',
    lineShadow: '0 0 0 1px rgba(255, 228, 180, 0.08), 0 8px 18px rgba(255, 170, 96, 0.14)',
  }
}

function applyExportThemeToClone(root: HTMLElement, theme: ExportTheme) {
  const themeConfig = getExportThemeConfig(theme)

  if (theme === 'dark') {
    return
  }

  // 纸张版不是简单换外层背景，而是把结果区内常见卡片面层一起改成浅色纸面，
  // 否则导出会出现浅色头部配深色正文，整体观感会断裂。
  root.style.color = themeConfig.wrapperColor
  root.style.background = 'transparent'
  root.style.border = 'none'
  root.style.boxShadow = 'none'

  root.querySelectorAll<HTMLElement>('*').forEach((node) => {
    node.style.color = themeConfig.wrapperColor
  })

  const panelSelectors = [
    '.result-card',
    '.classic-reading-item',
    '.classic-quote',
    '.summary-output',
    '.empty-state',
    '.moving-item',
    '.fact-box',
    '.note-box',
    '.hexagram-figure',
  ]

  panelSelectors.forEach((selector) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      node.style.background = themeConfig.panelBackground
      node.style.border = themeConfig.panelBorder
      node.style.boxShadow = 'none'
    })
  })

  root.querySelectorAll<HTMLElement>('.subtle-text, .result-label, .fact-label, .hexagram-line-name').forEach((node) => {
    node.style.color = themeConfig.metaColor
  })

  root.querySelectorAll<HTMLElement>('.summary-chip, .trigram-pair span, .row-value').forEach((node) => {
    node.style.background = themeConfig.panelMutedBackground
    node.style.border = themeConfig.panelMutedBorder
    node.style.color = themeConfig.wrapperColor
  })

  root.querySelectorAll<HTMLElement>('.line-full, .line-half').forEach((node) => {
    node.style.background = themeConfig.lineColor
    node.style.boxShadow = themeConfig.lineShadow
  })
}

function createExportHexagramPreview(
  title: string,
  snapshot: HexagramSnapshot,
  theme: ExportTheme,
): HTMLElement {
  const themeConfig = getExportThemeConfig(theme)
  const card = document.createElement('div')
  const label = document.createElement('strong')
  const name = document.createElement('p')
  const meta = document.createElement('p')
  const figure = document.createElement('div')

  card.style.display = 'grid'
  card.style.gap = '12px'
  card.style.padding = '18px'
  card.style.borderRadius = '20px'
  card.style.border = themeConfig.panelBorder
  card.style.background = themeConfig.panelBackground

  label.textContent = title
  label.style.fontSize = '13px'
  label.style.letterSpacing = '0.08em'
  label.style.color = themeConfig.accentColor

  name.textContent = snapshot.hexagram.name
  name.style.margin = '0'
  name.style.fontSize = '22px'
  name.style.lineHeight = '1.35'

  meta.textContent = `${snapshot.upperTrigram.name}${snapshot.upperTrigram.symbol} / ${snapshot.lowerTrigram.name}${snapshot.lowerTrigram.symbol}`
  meta.style.margin = '0'
  meta.style.fontSize = '14px'
  meta.style.color = themeConfig.metaColor

  figure.style.display = 'grid'
  figure.style.gap = '10px'
  figure.style.padding = '16px'
  figure.style.borderRadius = '18px'
  figure.style.border = themeConfig.panelBorder
  figure.style.background = themeConfig.panelMutedBackground

  snapshot.lines
    .slice()
    .reverse()
    .forEach((line) => {
      const row = document.createElement('div')

      row.style.display = 'grid'
      row.style.alignItems = 'center'

      if (line === 1) {
        row.style.gridTemplateColumns = '1fr'
        const full = document.createElement('span')
        full.style.display = 'block'
        full.style.width = '100%'
        full.style.height = '12px'
        full.style.borderRadius = '999px'
        full.style.background = themeConfig.lineColor
        full.style.boxShadow = themeConfig.lineShadow
        row.appendChild(full)
      } else {
        row.style.gridTemplateColumns = '1fr 16px 1fr'
        row.style.gap = '10px'

        const left = document.createElement('span')
        const gap = document.createElement('span')
        const right = document.createElement('span')

        ;[left, right].forEach((segment) => {
          segment.style.display = 'block'
          segment.style.width = '100%'
          segment.style.height = '12px'
          segment.style.borderRadius = '999px'
          segment.style.background = themeConfig.lineColor
          segment.style.boxShadow = themeConfig.lineShadow
        })

        gap.style.display = 'block'

        row.appendChild(left)
        row.appendChild(gap)
        row.appendChild(right)
      }

      figure.appendChild(row)
    })

  card.appendChild(label)
  card.appendChild(name)
  card.appendChild(meta)
  card.appendChild(figure)

  return card
}

function serializeComputedStyle(style: CSSStyleDeclaration): string {
  return Array.from(style)
    .map((property) => `${property}:${style.getPropertyValue(property)};`)
    .join('')
}

function cloneElementWithInlineStyles(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(false) as HTMLElement
  clone.setAttribute('style', serializeComputedStyle(window.getComputedStyle(source)))

  Array.from(source.childNodes).forEach((childNode) => {
    if (childNode.nodeType === Node.TEXT_NODE) {
      clone.appendChild(childNode.cloneNode(true))
      return
    }

    if (childNode instanceof HTMLElement) {
      clone.appendChild(cloneElementWithInlineStyles(childNode))
      return
    }

    clone.appendChild(childNode.cloneNode(true))
  })

  return clone
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

function loadImageFromUrl(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('导出图片时加载中间图像失败。'))
    image.src = imageUrl
  })
}

async function exportReadingAsImage({
  element,
  fileName,
  title,
  exportedAt,
  question,
  overviewLine,
  metaItems,
  theme,
  baseHexagram,
  changedHexagram,
}: {
  element: HTMLElement
  fileName: string
  title: string
  exportedAt: string
  question: string
  overviewLine: string
  metaItems: Array<{ label: string; value: string }>
  theme: ExportTheme
  baseHexagram: HexagramSnapshot
  changedHexagram: HexagramSnapshot
}): Promise<'picker' | 'download'> {
  const themeConfig = getExportThemeConfig(theme)
  const rect = element.getBoundingClientRect()
  const cloned = cloneElementWithInlineStyles(element)
  const wrapper = document.createElement('div')
  const header = document.createElement('div')
  const eyebrow = document.createElement('p')
  const titleNode = document.createElement('h1')
  const overviewNode = document.createElement('p')
  const metaNode = document.createElement('p')
  const questionNode = document.createElement('div')
  const questionLabel = document.createElement('strong')
  const questionText = document.createElement('p')
  const metaGrid = document.createElement('div')
  const visualGrid = document.createElement('div')
  const footer = document.createElement('div')
  const footerTitle = document.createElement('strong')
  const footerMeta = document.createElement('p')
  const safeQuestion = question.trim() || '未填写，占断以卦象本身为主。'

  applyExportThemeToClone(cloned, theme)

  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  wrapper.style.width = `${Math.ceil(rect.width)}px`
  wrapper.style.padding = '30px'
  wrapper.style.boxSizing = 'border-box'
  wrapper.style.display = 'grid'
  wrapper.style.gap = '18px'
  wrapper.style.background = themeConfig.wrapperBackground
  wrapper.style.color = themeConfig.wrapperColor

  // 长图头部在导出时动态注入，不改页面本身结构。
  // 这样既能保留页面实时交互，也能让导出的图片天然带上标题、时间与问题上下文。
  header.style.display = 'grid'
  header.style.gap = '10px'
  header.style.padding = '22px 24px'
  header.style.border = themeConfig.headerBorder
  header.style.borderRadius = '24px'
  header.style.background = themeConfig.headerBackground

  eyebrow.textContent = '周易起卦台'
  eyebrow.style.margin = '0'
  eyebrow.style.color = themeConfig.eyebrowColor
  eyebrow.style.fontSize = '12px'
  eyebrow.style.letterSpacing = '0.18em'
  eyebrow.style.textTransform = 'uppercase'

  titleNode.textContent = title
  titleNode.style.margin = '0'
  titleNode.style.fontSize = '30px'
  titleNode.style.lineHeight = '1.25'

  overviewNode.textContent = overviewLine
  overviewNode.style.margin = '0'
  overviewNode.style.fontSize = '18px'
  overviewNode.style.lineHeight = '1.6'
  overviewNode.style.color = themeConfig.overviewColor

  metaNode.textContent = `导出时间：${exportedAt}`
  metaNode.style.margin = '0'
  metaNode.style.fontSize = '15px'
  metaNode.style.color = themeConfig.metaColor

  visualGrid.style.display = 'grid'
  visualGrid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
  visualGrid.style.gap = '14px'
  visualGrid.appendChild(createExportHexagramPreview('本卦', baseHexagram, theme))
  visualGrid.appendChild(createExportHexagramPreview('变卦', changedHexagram, theme))

  metaGrid.style.display = 'grid'
  metaGrid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
  metaGrid.style.gap = '12px'

  metaItems.forEach((item) => {
    const metaItem = document.createElement('div')
    const metaLabel = document.createElement('strong')
    const metaValue = document.createElement('p')

    metaItem.style.display = 'grid'
    metaItem.style.gap = '6px'
    metaItem.style.padding = '14px 16px'
    metaItem.style.borderRadius = '18px'
    metaItem.style.border = themeConfig.panelBorder
    metaItem.style.background = themeConfig.panelBackground

    metaLabel.textContent = item.label
    metaLabel.style.fontSize = '13px'
    metaLabel.style.color = themeConfig.accentColor
    metaLabel.style.letterSpacing = '0.08em'

    metaValue.textContent = item.value
    metaValue.style.margin = '0'
    metaValue.style.fontSize = '16px'
    metaValue.style.lineHeight = '1.7'

    metaItem.appendChild(metaLabel)
    metaItem.appendChild(metaValue)
    metaGrid.appendChild(metaItem)
  })

  questionNode.style.display = 'grid'
  questionNode.style.gap = '8px'
  questionNode.style.padding = '14px 16px'
  questionNode.style.borderRadius = '18px'
  questionNode.style.background = themeConfig.panelMutedBackground
  questionNode.style.border = themeConfig.panelMutedBorder

  questionLabel.textContent = '占问事项'
  questionLabel.style.fontSize = '14px'
  questionLabel.style.color = themeConfig.accentColor

  questionText.textContent = safeQuestion
  questionText.style.margin = '0'
  questionText.style.fontSize = '17px'
  questionText.style.lineHeight = '1.8'

  footer.style.display = 'flex'
  footer.style.alignItems = 'center'
  footer.style.justifyContent = 'space-between'
  footer.style.gap = '14px'
  footer.style.flexWrap = 'wrap'
  footer.style.padding = '12px 16px'
  footer.style.borderRadius = '18px'
  footer.style.border = themeConfig.panelBorder
  footer.style.background = themeConfig.panelMutedBackground

  footerTitle.textContent = '周易起卦台 · 卦单留存'
  footerTitle.style.fontSize = '14px'
  footerTitle.style.letterSpacing = '0.08em'
  footerTitle.style.color = themeConfig.accentColor

  footerMeta.textContent = `主题：${getExportThemeLabel(theme)} · 导出于 ${exportedAt}`
  footerMeta.style.margin = '0'
  footerMeta.style.fontSize = '13px'
  footerMeta.style.color = themeConfig.metaColor

  questionNode.appendChild(questionLabel)
  questionNode.appendChild(questionText)
  footer.appendChild(footerTitle)
  footer.appendChild(footerMeta)
  header.appendChild(eyebrow)
  header.appendChild(titleNode)
  if (overviewLine) {
    header.appendChild(overviewNode)
  }
  header.appendChild(metaNode)
  header.appendChild(visualGrid)
  if (metaItems.length > 0) {
    header.appendChild(metaGrid)
  }
  header.appendChild(questionNode)
  wrapper.appendChild(header)
  wrapper.appendChild(cloned)
  wrapper.appendChild(footer)

  const measuringHost = document.createElement('div')
  measuringHost.style.position = 'fixed'
  measuringHost.style.left = '-99999px'
  measuringHost.style.top = '0'
  measuringHost.style.visibility = 'hidden'
  measuringHost.style.pointerEvents = 'none'
  document.body.appendChild(measuringHost)
  measuringHost.appendChild(wrapper)
  const fullHeight = Math.ceil(wrapper.scrollHeight)
  document.body.removeChild(measuringHost)

  const serialized = new XMLSerializer().serializeToString(wrapper)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(rect.width)}" height="${fullHeight}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await loadImageFromUrl(svgUrl)
    const canvas = document.createElement('canvas')
    const scale = Math.max(window.devicePixelRatio || 1, 2)
    canvas.width = Math.ceil(rect.width * scale)
    canvas.height = Math.ceil(fullHeight * scale)

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('当前浏览器环境不支持 canvas 导出。')
    }

    context.scale(scale, scale)
    context.drawImage(image, 0, 0, Math.ceil(rect.width), fullHeight)

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
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
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
  const rollingIntervalRef = useRef<number | null>(null)
  const rollingFinishRef = useRef<number | null>(null)
  const ritualMessageRef = useRef<number | null>(null)
  const exportNoticeRef = useRef<number | null>(null)

  const filledCoinRows = coinBoard.filter((row) => row.every(Boolean)).length

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

  function updateCoinFace(rowIndex: number, coinIndex: number, face: CoinFace) {
    if (isRolling) {
      return
    }

    setCoinBoard((current) =>
      current.map((row, currentRowIndex) => {
        if (currentRowIndex !== rowIndex) {
          return row
        }

        return row.map((value, currentCoinIndex) =>
          currentCoinIndex === coinIndex ? face : value,
        ) as CoinRow
      }),
    )
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

      const fileName = `suangua-${mode === 'coin' ? 'jinqiangua' : 'meihuayishu'}-${getExportThemeFileKey(exportTheme)}-${fileStamp}.png`
      const saveMethod = await exportReadingAsImage({
        element: resultPanelRef.current,
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

        <div className="hero-highlights">
          <span>双模式切换</span>
          <span>六爻动态展示</span>
          <span>体用五行分析</span>
          <span>移动端自适应</span>
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
      </section>

      <main className="workspace">
        <section className="input-panel">
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

              {ritualMessage ? <div className="ritual-banner">{ritualMessage}</div> : null}

              <div className="coin-list">
                {coinBoard.map((row, rowIndex) => {
                  const isComplete = row.every(Boolean)
                  const lineValue = isComplete ? getCoinLineValue(row as CoinFace[]) : null
                  const isRollingRow = rollingRows.includes(rowIndex)

                  return (
                    <article
                      className={[
                        'coin-row',
                        isComplete ? 'is-complete' : '',
                        isRollingRow ? 'is-rolling' : '',
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
              <small>不填写也可以，仅按卦象本身输出摘要。</small>
            </label>
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

          {exportNotice ? <div className="notice-banner">{exportNotice}</div> : null}

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
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}

export default App
