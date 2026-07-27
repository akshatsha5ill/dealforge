import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './index';

describe('Zustand Store', () => {
  beforeEach(() => {
    useStore.setState({
      user: null,
      isAuthenticated: false,
      openAiKey: '',
      anthropicKey: '',
      geminiKey: '',
      resendKey: '',
      error: null,
      loading: false,
    });
  });

  it('has correct initial state', () => {
    const state = useStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.openAiKey).toBe('');
    expect(state.anthropicKey).toBe('');
    expect(state.geminiKey).toBe('');
    expect(state.resendKey).toBe('');
  });

  it('sets OpenAI key', () => {
    useStore.getState().setOpenAiKey('sk-test123');
    expect(useStore.getState().openAiKey).toBe('sk-test123');
  });

  it('sets Anthropic key', () => {
    useStore.getState().setAnthropicKey('sk-ant-test');
    expect(useStore.getState().anthropicKey).toBe('sk-ant-test');
  });

  it('sets Gemini key', () => {
    useStore.getState().setGeminiKey('AIza-test');
    expect(useStore.getState().geminiKey).toBe('AIza-test');
  });

  it('sets Resend key', () => {
    useStore.getState().setResendKey('re_test');
    expect(useStore.getState().resendKey).toBe('re_test');
  });

  it('sets error state', () => {
    useStore.getState().setError('Something failed');
    expect(useStore.getState().error).toBe('Something failed');
  });

  it('clears error state', () => {
    useStore.getState().setError('Something failed');
    useStore.getState().clearError();
    expect(useStore.getState().error).toBeNull();
  });

  it('logout clears all keys and user', () => {
    useStore.setState({
      user: { uid: '123', email: 'test@test.com' } as never,
      isAuthenticated: true,
      openAiKey: 'sk-test',
      anthropicKey: 'sk-ant-test',
      geminiKey: 'AIza-test',
      resendKey: 're_test',
    });

    useStore.getState().logout();

    const state = useStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.openAiKey).toBe('');
    expect(state.anthropicKey).toBe('');
    expect(state.geminiKey).toBe('');
    expect(state.resendKey).toBe('');
  });
});
