import * as request from 'request-promise';
import { AES } from 'crypto-js';

import { Client } from './Client';
import { Config } from './Config';
import { OAuthPayload, Payload } from './interfaces/Request';
import { TokenPair } from './interfaces/TokenStore';
import { Logger } from './Logger';
import { Purifier } from './Purifier';

export class Authenticator extends Client {

  async login(username: string, password: string): Promise<TokenPair> {
    const stateId = await this.getStateId();
    const cookies = await this.authenticate(stateId, username, password);
    const authCode = await this.getAuthCode(cookies);

    const tokens = await this.getTokensFromAuthCode(authCode);
    this.tokenStore.saveTokens(tokens);

    return tokens;
  }

  async getPurifiers(tokens: TokenPair): Promise<Purifier[]> {
    const payload = this.buildDeviceListPayload(tokens);
    Logger.debug('Sending payload', payload);

    const response = await request.post(payload);
    Logger.debug('Got response', response);

    return response.body.deviceInfos.map(device => new Purifier(device.barcode, device.dvcNick));
  }

  async refreshTokens(oldTokens: TokenPair): Promise<TokenPair> {
    const payload = this.buildTokenRefreshPayload(oldTokens);
    Logger.debug('Sending payload', payload);

    const response = await request.post(payload);
    Logger.debug('Sending payload', payload);

    const tokens = {
      accessToken: response.header.accessToken,
      refreshToken: response.header.refreshToken,
    };

    return tokens;
  }

  private async getStateId(): Promise<string> {
    const payload = this.buildOauthPayload();
    const response = await request.get(payload);
    const query = response.request.uri.query;

    return query.match(/(?<=state\=)(.*?)$/)[0];
  }

  private async authenticate(stateId: string, username: string, password: string): Promise<string> {

    const payload = {
      uri: Config.Auth.SIGNIN_URL,
      resolveWithFullResponse: true,
      json: true,
      headers: {
        'Content-Type': Config.ContentType.JSON,
        'User-Agent': Config.USER_AGENT,
      },
      body: {
        'username': username,
        'password': this.encryptPass(password),
        'state': stateId,
        'auto_login': 'Y',
      },
    };

    const response = await request.post(payload);
    const cookies = response.headers['set-cookie'];

    return cookies;
  }

  // Replacement algorithm for lib/util/aes
  // NOTE(mroth): found a more readable algorithm at https://github.com/evandcoleman/python-iocare/blob/master/iocare/iocareapi.py
  private encryptPass(password: string): string {
    const iv = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.lib.WordArray.random(16);
    const i = iv.toString(CryptoJS.enc.Base64);
    const k = key.toString(CryptoJS.enc.Base64);
    const encryptedPass = AES.encrypt(password, key, { iv: iv });
    const passBlockStr = i + ':' + encryptedPass.ciphertext.toString() + ':' + k;
    return passBlockStr;
  }

  private async getAuthCode(cookies: string): Promise<string> {
    const payload = this.buildOauthPayload(cookies);
    const response = await request.get(payload);
    const query = response.request.uri.query;

    return query.match(/(?<=code\=)(.*?)(?=\&)/)[0];
  }

  private async getTokensFromAuthCode(authCode: string): Promise<TokenPair> {
    const payload = this.buildFinishOauthPayload(authCode);
    Logger.debug('Sending payload', payload);

    const response = await request.post(payload);
    Logger.debug('Got response', response);

    const tokens = {
      accessToken: response.header.accessToken,
      refreshToken: response.header.refreshToken,
    };

    return tokens;
  }

  // Similar OAuth payloads are used when retrieving the state ID as well
  // as the auth code, the latter of which requires cookies.
  private buildOauthPayload(cookies?: string): OAuthPayload {
    const payload: OAuthPayload = {
      uri: Config.Auth.OAUTH_URL,
      resolveWithFullResponse: true,
      headers: {
        'User-Agent': Config.USER_AGENT,
        Cookie: cookies,
      },
      qs: {
        auth_type: 0,
        response_type: 'code',
        client_id: Config.Auth.CLIENT_ID,
        scope: 'login',
        lang: 'en_US',
        redirect_url: Config.Auth.REDIRECT_URL,
      },
    };

    return payload;
  }

  private buildFinishOauthPayload(authCode: string): Payload {
    const message = {
      header: {
        trcode: Config.Endpoints.TOKEN_REFRESH,
        accessToken: '',
        refreshToken: '',
      },
      body: {
        authCode: authCode,
        isMobile: 'M',
        langCd: 'en',
        osType: 1,
        redirectUrl: Config.Auth.REDIRECT_URL,
        serviceCode: Config.Auth.SERVICE_CODE,
      },
    };

    const payload = this.buildPayload(Config.Endpoints.TOKEN_REFRESH, message);

    return payload;
  }

  private buildDeviceListPayload(tokens: TokenPair): Payload {
    const message = {
      header: {
        trcode: Config.Endpoints.DEVICE_LIST,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      body: {
        pageIndex: '0',
        pageSize: '100',
      },
    };

    const payload = this.buildPayload(Config.Endpoints.DEVICE_LIST, message);

    return payload;
  }

  private buildTokenRefreshPayload(tokens: TokenPair): Payload {
    const message = {
      header: {
        trcode: Config.Endpoints.TOKEN_REFRESH,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      body: {
        isMobile: 'M',
        langCd: 'en',
        osType: 1,
        redirectUrl: Config.Auth.REDIRECT_URL,
        serviceCode: Config.Auth.SERVICE_CODE,
      },
    };

    const payload = this.buildPayload(Config.Endpoints.TOKEN_REFRESH, message);

    return payload;
  }
}