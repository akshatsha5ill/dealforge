import { describe, it, expect } from 'vitest';
import { parseTranscriptFile, ParsedTranscript } from './transcript-parser';

describe('transcript-parser', () => {
  describe('parseTranscriptFile', () => {
    it('parses plain text with speaker prefixes', () => {
      const result = parseTranscriptFile('meeting.txt', 'Alice: Hello there\nBob: Hi Alice\nAlice: Great to see you');
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0]).toMatchObject({ speaker: 'Alice', text: 'Hello there' });
      expect(result.segments[1]).toMatchObject({ speaker: 'Bob', text: 'Hi Alice' });
      expect(result.fullText).toContain('Alice: Hello there');
    });

    it('merges continuation lines into the current speaker', () => {
      const result = parseTranscriptFile('meeting.txt', 'Alice: First line\nsecond line');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe('First line\nsecond line');
    });

    it('treats unlabeled text as a single anonymous segment', () => {
      const result = parseTranscriptFile('meeting.txt', 'Just some notes without speakers');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].speaker).toBe('Speaker 1');
      expect(result.fullText).toBe('Speaker 1: Just some notes without speakers');
    });

    it('parses SRT files with timestamps and duration', () => {
      const srt = `1\n00:00:00,000 --> 00:00:03,500\nAlice: Welcome everyone\n\n2\n00:00:04,000 --> 00:00:10,000\nBob: Thanks for having me`;
      const result = parseTranscriptFile('meeting.srt', srt);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]).toMatchObject({ speaker: 'Alice', text: 'Welcome everyone', startTime: 0, endTime: 3.5 });
      expect(result.segments[1]).toMatchObject({ speaker: 'Bob', text: 'Thanks for having me', startTime: 4, endTime: 10 });
      expect(result.durationSeconds).toBe(10);
    });

    it('parses VTT files including the WEBVTT header', () => {
      const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Alice>Hello</v>\n\n00:00:05.000 --> 00:00:08.000\n<v Bob>Hi</v>`;
      const result = parseTranscriptFile('meeting.vtt', vtt);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]).toMatchObject({ speaker: 'Alice', text: 'Hello', startTime: 1, endTime: 4 });
      expect(result.durationSeconds).toBe(8);
    });

    it('returns empty result for empty content', () => {
      const result: ParsedTranscript = parseTranscriptFile('empty.txt', '');
      expect(result.segments).toEqual([]);
      expect(result.fullText).toBe('');
      expect(result.durationSeconds).toBe(0);
    });
  });
});
