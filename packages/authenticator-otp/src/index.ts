import { DatabaseInterface, AuthenticatorService, Authenticator } from '@accounts/types';
import { AccountsServer } from '@accounts/server';
import * as otplib from 'otplib';

interface DbAuthenticatorOtp extends Authenticator {
  secret: string;
}

export interface AuthenticatorOtpOptions {
  /**
   * Two factor app name that will be displayed inside the user authenticator app.
   */
  appName?: string;

  /**
   * Two factor user name that will be displayed inside the user authenticator app,
   * usually a name, email etc..
   * Will be called every time a user register a new device.
   * That way you can display something like "Github (accounts-js)" in the authenticator app.
   */
  userName?: (userId: string) => Promise<string> | string;
}

const defaultOptions = {
  appName: 'accounts-js',
};

export class AuthenticatorOtp implements AuthenticatorService {
  public serviceName = 'otp';
  public server!: AccountsServer;

  private options: AuthenticatorOtpOptions & typeof defaultOptions;
  private db!: DatabaseInterface;

  constructor(options: AuthenticatorOtpOptions = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  public setStore(store: DatabaseInterface) {
    this.db = store;
  }

  /**
   * Start the association of a new OTP device
   */
  public async associate(
    userId: string,
    params: any
  ): Promise<{ id: string; secret: string; otpauthUri: string }> {
    const secret = otplib.authenticator.generateSecret();
    const userName = this.options.userName ? await this.options.userName(userId) : userId;
    const otpauthUri = otplib.authenticator.keyuri(userName, this.options.appName, secret);
    // TODO generate some recovery codes like slack is doing (as an option, or maybe should just be a separate authenticator so it can be used by anything)?

    const authenticatorId = await this.db.createAuthenticator({
      type: this.serviceName,
      userId,
      secret,
      active: false,
    });

    return {
      id: authenticatorId,
      secret,
      otpauthUri,
    };
  }

  /**
   * Verify that the code provided by the user is valid
   */
  public async authenticate(
    authenticator: DbAuthenticatorOtp,
    { code }: { code?: string }
  ): Promise<boolean> {
    if (!code) {
      throw new Error('Code required');
    }

    return otplib.authenticator.check(code, authenticator.secret);
  }
}
