import { createHmac } from 'crypto'
import {
  Extension,
  onChangePayload,
  onConfigurePayload,
  onConnectPayload,
  onCreateDocumentPayload,
  onDestroyPayload,
  onDisconnectPayload,
  onListenPayload,
  onRequestPayload,
  onUpgradePayload,
} from '@hocuspocus/server'
import { Doc } from 'yjs'
import { TiptapTransformer, Transformer } from '@hocuspocus/transformer'
import axios from 'axios'
import Timeout = NodeJS.Timeout

export interface Configuration {
  debounce: number | false | null,
  debounceMaxWait: number,
  secret: string,
  transformer: Transformer | ((document: Doc) => any),
  urls: Array<string>,
}

export class Webhook implements Extension {

  configuration: Configuration = {
    debounce: 2000,
    debounceMaxWait: 10000,
    secret: '',
    transformer: TiptapTransformer,
    urls: [],
  }

  debounced: Map<string, { timeout: Timeout, start: number }> = new Map()

  /**
   * Constructor
   */
  constructor(configuration?: Partial<Configuration>) {
    this.configuration = {
      ...this.configuration,
      ...configuration,
    }
  }

  /**
   * Create a signature for the response body
   */
  createSignature(body: string): string {
    const hmac = createHmac('sha256', this.configuration.secret)

    return `sha256=${hmac.update(body).digest('hex')}`
  }

  /**
   * debounce the given function, using the given identifier
   */
  debounce(id: string, func: Function) {
    const old = this.debounced.get(id)
    const start = old?.start || Date.now()

    const run = () => {
      this.debounced.delete(id)
      func()
    }

    if (old?.timeout) clearTimeout(old.timeout)
    if (Date.now() - start >= this.configuration.debounceMaxWait) return run()

    this.debounced.set(id, {
      start,
      timeout: setTimeout(run, <number> this.configuration.debounce),
    })
  }

  /**
   * Get data from the given y-doc using the configured transformer
   */
  getDataFromYdoc(document: Doc) {
    const transformer = <Transformer> this.configuration.transformer
    const callableTransformer = <((document: Doc) => any)> this.configuration.transformer

    if (transformer.fromYdoc !== undefined) return transformer.fromYdoc(document)

    return callableTransformer(document)
  }

  /**
   * Send a request to the given url containing the given data
   */
  async sendRequest(url: string, data: any) {
    const json = JSON.stringify(data)

    axios
      .post(url, json, { headers: { 'X-Hocuspocus-Signature-256': this.createSignature(json) } })
      .catch(e => console.log(`[${new Date().toISOString()}] Request to ${url} failed:`, e.message))
  }

  /**
   * onChange hook
   */
  async onChange(data: onChangePayload) {
    const save = () => {
      this.configuration.urls.forEach(url => this.sendRequest(url, {
        data: this.getDataFromYdoc(data.document),
        documentName: data.documentName,
        context: data.context,
      }))
    }

    if (!this.configuration.debounce) {
      return save()
    }

    this.debounce(data.documentName, save)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onCreateDocument(data: onCreateDocumentPayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onConnect(data: onConnectPayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onDisconnect(data: onDisconnectPayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onUpgrade(data: onUpgradePayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onRequest(data: onRequestPayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onListen(data: onListenPayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onDestroy(data: onDestroyPayload) {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function,no-empty-function
  async onConfigure(data: onConfigurePayload) {
  }

}