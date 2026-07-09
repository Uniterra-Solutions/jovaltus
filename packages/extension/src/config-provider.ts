import * as vscode from 'vscode';
import type { ConfigProvider } from '@jovaltus/core';

export class VSCodeConfigProvider implements ConfigProvider {
  constructor(private readonly secretKeys: ReadonlyMap<string, string>) {}

  public get<T>(key: string, defaultValue: T): T {
    const parts = key.split('.');
    const root = parts[0] ?? 'jovaltus';
    const section = parts.slice(1).join('.');

    const secretVal = this.secretKeys.get(section);
    if (secretVal !== undefined) return secretVal as T;

    const value = vscode.workspace.getConfiguration(root).get<T>(section);
    return value !== undefined ? value : defaultValue;
  }
}
