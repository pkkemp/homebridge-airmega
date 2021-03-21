import * as store from 'store';

import { Authenticator } from './Authenticator';
import { TokenPair } from './interfaces/TokenStore';
import { Logger } from './Logger';

export class TokenStore {
  static readonly TOKEN_KEY = 'tokens';
  static readonly TOKEN_EXP_LENGTH = 3600000;

  saveTokens(tokens: TokenPair): void {
    tokens.storedAt = Date.now();

    store.set(TokenStore.TOKEN_KEY, tokens);
  }

  async getTokens(): Promise<TokenPair> {
    const tokens = store.get(TokenStore.TOKEN_KEY);

    if (!this.isExpired()) {
      return tokens;
    }

    Logger.debug('Auth tokens are expired, refreshing...');

    try {
      const authenticator = new Authenticator();
      const newTokens = await authenticator.refreshTokens(tokens);

      this.saveTokens(newTokens);

      Logger.debug('Token refresh succeeded');

      return newTokens;
    } catch(e) {
      Logger.error('Unable to refresh tokens', e);
    }
  }

  isExpired(): boolean {
    const tokens: TokenPair = store.get('tokens');

    return (Date.now() - tokens.storedAt) >= TokenStore.TOKEN_EXP_LENGTH;
  }
}