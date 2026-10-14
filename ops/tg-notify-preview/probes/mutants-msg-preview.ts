/**
 * 变异体（负向探针用）· **仓外副本等价体**：本文件是 `backend-ts/src/messages-service.ts`
 * `buildMessagePreview` / `buildMessageNotificationText` 的**手写等价副本**，只改一处尺子/一处规则，
 * 用于证明 AC-1 的断言尺子**灵敏**（变异体必须判红）。
 *
 *   M1 `mutantPreviewTrunc7`       —— 预算由 6 改 **7** 显示宽单位（截 7 单位尺子）
 *   M2 `mutantNotificationAlways`  —— 空预览也**照插「」预览段**（破「空正文不追加预览段」）
 *
 * 位置披露：`/Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/mutants-msg-preview.ts`
 * （**未跟踪、未提交**；`backend-ts/**` 一字未改 —— 变异只存在于本副本内）。
 */
const MUTANT_MAX_WIDTH_UNITS = 7;

const MUTANT_WIDE_UNIT_RE =
  /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE4F\uFF01-\uFF60\uFFE0-\uFFE6]/u;

const mutantClustersOf = (text: string): string[] => {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale: string, options: { granularity: string }) => { segment(input: string): Iterable<{ segment: string }> };
  }).Segmenter;
  if (typeof Segmenter === 'function') {
    const out: string[] = [];
    for (const part of new Segmenter('en', { granularity: 'grapheme' }).segment(text)) out.push(part.segment);
    return out;
  }
  return Array.from(text);
};

/** M1：与真实现逐句等价，唯一差异 = 预算 6 → 7。 */
export const mutantPreviewTrunc7 = (body: unknown): string => {
  const text = typeof body === 'string' ? body.trim() : '';
  if (text === '') return '';
  let units = 0;
  let preview = '';
  for (const cluster of mutantClustersOf(text)) {
    const width = MUTANT_WIDE_UNIT_RE.test(cluster) ? 2 : 1;
    if (units + width > MUTANT_MAX_WIDTH_UNITS) return `${preview}…`;
    preview += cluster;
    units += width;
  }
  return preview;
};

/** M2：与真实现逐句等价，唯一差异 = 预览为空也照插「」段（破「空正文不追加预览段」）。 */
export const mutantNotificationAlwaysPreview = (input: {
  siteName: string;
  site: string;
  maskedTitle: string;
  preview?: string;
}): string => {
  const zhHead = `${input.siteName}：你有新消息（来自会话：${input.maskedTitle}）`;
  const zhTail = `，打开 ${input.site}/messages 查看`;
  const enHalf = ` / You have a new message, open ${input.site}/messages`;
  return `${zhHead}「${input.preview ?? ''}」${zhTail}${enHalf}`;
};
