export interface MessageHeader {
  trcode: string;
  accessToken: string;
  refreshToken: string;
}

export interface Message {
  header: MessageHeader;
  body: any;
}

export interface Payload {
  uri: string;
  headers: any;
  json: boolean;
  form: string;
}

export interface OpenIDPayload {
  uri: string;
  headers: any;
  qs: any;
  resolveWithFullResponse?: boolean;
}

export interface AuthCode2Payload {
  uri: string;
  headers: any;
  form: any;
  resolveWithFullResponse?: boolean;
  simple?: boolean;
}
