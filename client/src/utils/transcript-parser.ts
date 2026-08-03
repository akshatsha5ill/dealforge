import { TranscriptSegment } from '../types';

export interface ParsedTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  durationSeconds: number;
}

const SPEAKER_LINE = /^([A-Za-z0-9 .\-'']+?)\s*:\s*(.+)$/;
const SRT_TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/;
const VTT_TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/;
const VTT_SPEAKER = /<v\s+([^>]+)>([\s\S]*?)<\/v>/;

const toSeconds = (h: number, m: number, s: number, ms: number) => h * 3600 + m * 60 + s + ms / 1000;

function extractSpeaker(text: string): { speaker?: string; text: string } {
  const vttMatch = VTT_SPEAKER.exec(text);
  if (vttMatch) {
    return { speaker: vttMatch[1].trim(), text: vttMatch[2].trim() };
  }
  const plainMatch = SPEAKER_LINE.exec(text.trim());
  if (plainMatch) {
    return { speaker: plainMatch[1].trim(), text: plainMatch[2].trim() };
  }
  return { text: text.trim() };
}

export function parseTranscriptFile(filename: string, content: string): ParsedTranscript {
  const extension = (filename.split('.').pop() || '').toLowerCase();
  if (extension === 'srt' || extension === 'vtt') {
    return parseTimedTranscript(content, extension === 'srt');
  }
  return parsePlainText(content);
}

function parseTimedTranscript(content: string, isSrt: boolean): ParsedTranscript {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const segments: TranscriptSegment[] = [];
  let i = 0;

  if (!isSrt) {
    // Skip WEBVTT header / NOTE blocks
    while (i < lines.length && !VTT_TIMESTAMP.test(lines[i].trim())) i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = VTT_TIMESTAMP.exec(line) || SRT_TIMESTAMP.exec(line);
    if (match) {
      const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
      const start = toSeconds(Number(h1), Number(m1), Number(s1), Number(ms1));
      const end = toSeconds(Number(h2), Number(m2), Number(s2), Number(ms2));
      i++;
      // Skip cue identifier line for SRT (already consumed timestamp for VTT)
      if (isSrt && i < lines.length && SRT_TIMESTAMP.test(lines[i].trim())) {
        i++;
      }
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !VTT_TIMESTAMP.test(lines[i].trim()) && !SRT_TIMESTAMP.test(lines[i].trim())) {
        textLines.push(lines[i].trim());
        i++;
      }
      const raw = textLines.join('\n');
      const { speaker, text } = extractSpeaker(raw);
      if (text) {
        segments.push({ speaker: speaker || `Speaker ${segments.length + 1}`, text, startTime: start, endTime: end });
      }
    } else {
      i++;
    }
  }

  return buildResult(segments);
}

function parsePlainText(content: string): ParsedTranscript {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const speakerMatch = SPEAKER_LINE.exec(line);
    if (speakerMatch) {
      if (current) segments.push(current);
      current = {
        speaker: speakerMatch[1].trim(),
        text: speakerMatch[2].trim(),
        startTime: 0,
        endTime: 0,
      };
    } else if (current) {
      current.text += '\n' + line;
    } else {
      segments.push({ speaker: 'Speaker 1', text: line, startTime: 0, endTime: 0 });
    }
  }
  if (current) segments.push(current);

  return buildResult(segments);
}

function buildResult(segments: TranscriptSegment[]): ParsedTranscript {
  const fullText = segments.map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text)).join('\n\n');
  const durationSeconds = segments.length > 0 ? Math.max(0, segments[segments.length - 1].endTime) : 0;
  return { segments, fullText, durationSeconds };
}
