import {
  IAddInvoiceBlixtLspArgs,
  IReadLndLogResponse,
  gossipSync,
  TEMP_moveLndToApplicationSupport,
  addInvoice,
  addInvoiceBlixtLsp,
  cancelInvoice,
  checkApplicationSupportExists,
  checkICloudEnabled,
  checkLndFolderExists,
  checkStatus,
  connectPeer,
  createIOSApplicationSupportAndLndDirectories,
  decodePayReq,
  decodeState,
  disconnectPeer,
  excludeLndICloudBackup,
  getInfo,
  getNetworkInfo,
  getNodeInfo,
  getRecoveryInfo,
  initialize,
  trackPaymentV2Sync,
  listPeers,
  listUnspent,
  lookupInvoice,
  queryRoutes,
  readLndLog,
  resetMissionControl,
  sendPaymentSync,
  sendPaymentV2Sync,
  startLnd,
  subscribeState,
  writeConfig,
  writeConfigFile,
} from "../lndmobile/index";
import {
  abandonChannel,
  channelAcceptor,
  channelAcceptorResponse,
  channelBalance,
  closeChannel,
  decodeChannelAcceptRequest,
  decodeChannelEvent,
  exportAllChannelBackups,
  listChannels,
  openChannel,
  openChannelAll,
  pendingChannels,
  subscribeChannelEvents,
} from "../lndmobile/channel";
import {
  decodeInvoiceResult,
  deriveKey,
  derivePrivateKey,
  genSeed,
  initWallet,
  signMessage,
  signMessageNodePubkey,
  subscribeInvoices,
  unlockWallet,
  verifyMessageNodePubkey,
} from "../lndmobile/wallet";
import {
  getTransactions,
  newAddress,
  sendCoins,
  sendCoinsAll,
  subscribeTransactions,
  walletBalance,
} from "../lndmobile/onchain";
import { status, modifyStatus, queryScores, setScores } from "../lndmobile/autopilot";
import { checkScheduledSyncWorkStatus } from "../lndmobile/scheduled-sync"; // TODO(hsjoberg): This could be its own injection "LndMobileScheduledSync"
import { checkScheduledGossipSyncWorkStatus } from "../lndmobile/scheduled-gossip-sync";
import { lnrpc, signrpc, invoicesrpc, autopilotrpc, routerrpc } from "../../proto/lightning";
import { WorkInfo } from "../lndmobile/LndMobile";

export interface ILndMobileInjections {
  index: {
    initialize: () => Promise<{ data: string } | number>;
    writeConfig: (config: string) => Promise<string>;
    writeConfigFile: () => Promise<string>;
    subscribeState: () => Promise<string>;
    decodeState: (data: string) => lnrpc.SubscribeStateResponse;
    checkStatus: () => Promise<number>;
    startLnd: (torEnabled: boolean, args: string) => Promise<string>;
    gossipSync: (networkType: string) => Promise<{ data: string }>;
    checkICloudEnabled: () => Promise<boolean>;
    checkApplicationSupportExists: () => Promise<boolean>;
    checkLndFolderExists: () => Promise<boolean>;
    createIOSApplicationSupportAndLndDirectories: () => Promise<boolean>;
    TEMP_moveLndToApplicationSupport: () => Promise<boolean>;
    excludeLndICloudBackup: () => Promise<boolean>;
    addInvoice: (
      amount: number,
      memo: string,
      expiry?: number,
    ) => Promise<lnrpc.AddInvoiceResponse>;
    addInvoiceBlixtLsp: (args: IAddInvoiceBlixtLspArgs) => Promise<lnrpc.AddInvoiceResponse>;
    cancelInvoice: (paymentHash: string) => Promise<invoicesrpc.CancelInvoiceResp>;
    connectPeer: (pubkey: string, host: string) => Promise<lnrpc.ConnectPeerResponse>;
    disconnectPeer: (pubkey: string) => Promise<lnrpc.DisconnectPeerResponse>;
    decodePayReq: (bolt11: string) => Promise<lnrpc.PayReq>;
    getRecoveryInfo: () => Promise<lnrpc.GetRecoveryInfoResponse>;
    listUnspent: () => Promise<lnrpc.ListUnspentResponse>;
    resetMissionControl: () => Promise<routerrpc.ResetMissionControlResponse>;
    getInfo: () => Promise<lnrpc.GetInfoResponse>;
    getNetworkInfo: () => Promise<lnrpc.NetworkInfo>;
    getNodeInfo: (pubKey: string) => Promise<lnrpc.NodeInfo>;
    trackPaymentV2Sync: (rHash: string) => Promise<lnrpc.Payment>;
    lookupInvoice: (rHash: string) => Promise<lnrpc.Invoice>;
    listPeers: () => Promise<lnrpc.ListPeersResponse>;
    readLndLog: () => Promise<IReadLndLogResponse>;
    sendPaymentSync: (
      paymentRequest: string,
      amount?: Long,
      tlvRecordName?: string | null,
    ) => Promise<lnrpc.SendResponse>;
    sendPaymentV2Sync: (
      paymentRequest: string,
      amount?: Long,
      payAmount?: Long,
      tlvRecordName?: string | null,
      multiPath?: boolean,
      maxLNFeePercentage?: number,
    ) => Promise<lnrpc.Payment>;
    queryRoutes: (
      pubkey: string,
      amount?: Long,
      routeHints?: lnrpc.IRouteHint[],
    ) => Promise<lnrpc.QueryRoutesResponse>;
  };
  channel: {
    channelBalance: () => Promise<lnrpc.ChannelBalanceResponse>;
    channelAcceptor: () => Promise<string>;
    decodeChannelAcceptRequest: (data: any) => lnrpc.ChannelAcceptRequest;
    channelAcceptorResponse: (
      pendingChanId: Uint8Array,
      accept: boolean,
      zeroConf?: boolean,
    ) => Promise<void>;
    closeChannel: (fundingTxId: string, outputIndex: number, force: boolean) => Promise<string>;
    listChannels: () => Promise<lnrpc.ListChannelsResponse>;
    openChannel: (
      pubkey: string,
      amount: number,
      privateChannel: boolean,
      feeRateSat?: number,
    ) => Promise<lnrpc.ChannelPoint>;
    openChannelAll: (
      pubkey: string,
      privateChannel: boolean,
      feeRateSat?: number,
    ) => Promise<lnrpc.ChannelPoint>;
    pendingChannels: () => Promise<lnrpc.PendingChannelsResponse>;
    subscribeChannelEvents: () => Promise<string>;
    decodeChannelEvent: (data: string) => lnrpc.ChannelEventUpdate;
    exportAllChannelBackups: () => Promise<lnrpc.ChanBackupSnapshot>;
    abandonChannel: (
      fundingTxId: string,
      outputIndex: number,
    ) => Promise<lnrpc.AbandonChannelResponse>;
  };
  onchain: {
    getTransactions: () => Promise<lnrpc.TransactionDetails>;
    newAddress: (type: lnrpc.AddressType) => Promise<lnrpc.NewAddressResponse>;
    sendCoins: (address: string, sat: number, feeRate?: number) => Promise<lnrpc.SendCoinsResponse>;
    sendCoinsAll: (address: string, feeRate?: number) => Promise<lnrpc.SendCoinsResponse>;
    walletBalance: () => Promise<lnrpc.WalletBalanceResponse>;
    subscribeTransactions: () => Promise<string>;
  };
  wallet: {
    decodeInvoiceResult: (data: string) => lnrpc.Invoice;
    genSeed: (passphrase: string | undefined) => Promise<lnrpc.GenSeedResponse>;
    initWallet: (
      seed: string[],
      password: string,
      recoveryWindow?: number,
      channelBackupsBase64?: string,
      aezeedPassphrase?: string,
    ) => Promise<void>;
    subscribeInvoices: () => Promise<string>;
    unlockWallet: (password: string) => Promise<void>;
    deriveKey: (keyFamily: number, keyIndex: number) => Promise<signrpc.KeyDescriptor>;
    derivePrivateKey: (keyFamily: number, keyIndex: number) => Promise<signrpc.KeyDescriptor>;
    verifyMessageNodePubkey: (
      signature: string,
      msg: Uint8Array,
    ) => Promise<lnrpc.VerifyMessageResponse>;
    signMessage: (
      keyFamily: number,
      keyIndex: number,
      msg: Uint8Array,
    ) => Promise<signrpc.SignMessageResp>;
    signMessageNodePubkey: (msg: Uint8Array) => Promise<lnrpc.SignMessageResponse>;
  };
  autopilot: {
    status: () => Promise<autopilotrpc.StatusResponse>;
    modifyStatus: (enable: boolean) => Promise<autopilotrpc.ModifyStatusResponse>;
    queryScores: () => Promise<autopilotrpc.QueryScoresResponse>;
    setScores: (scores: any) => Promise<autopilotrpc.SetScoresResponse>;
  };
  scheduledSync: {
    checkScheduledSyncWorkStatus: () => Promise<WorkInfo>;
  };
  scheduledGossipSync: {
    checkScheduledGossipSyncWorkStatus: () => Promise<WorkInfo>;
  };
}

export default {
  index: {
    initialize,
    writeConfig,
    writeConfigFile,
    checkStatus,
    subscribeState,
    decodeState,
    startLnd,
    gossipSync,
    checkICloudEnabled,
    checkApplicationSupportExists,
    checkLndFolderExists,
    createIOSApplicationSupportAndLndDirectories,
    TEMP_moveLndToApplicationSupport,
    excludeLndICloudBackup,

    addInvoice,
    addInvoiceBlixtLsp,
    cancelInvoice,
    connectPeer,
    disconnectPeer,
    decodePayReq,
    getRecoveryInfo,
    listUnspent,
    resetMissionControl,
    getNodeInfo,
    trackPaymentV2Sync,
    getNetworkInfo,
    getInfo,
    lookupInvoice,
    listPeers,
    readLndLog,
    sendPaymentSync,
    sendPaymentV2Sync,
    queryRoutes,
  },
  channel: {
    channelBalance,
    channelAcceptor,
    decodeChannelAcceptRequest,
    channelAcceptorResponse,
    closeChannel,
    listChannels,
    openChannel,
    openChannelAll,
    pendingChannels,
    subscribeChannelEvents,
    decodeChannelEvent,
    exportAllChannelBackups,
    abandonChannel,
  },
  onchain: {
    getTransactions,
    newAddress,
    sendCoins,
    sendCoinsAll,
    walletBalance,
    subscribeTransactions,
  },
  wallet: {
    decodeInvoiceResult,
    genSeed,
    initWallet,
    subscribeInvoices,
    unlockWallet,
    deriveKey,
    derivePrivateKey,
    verifyMessageNodePubkey,
    signMessage,
    signMessageNodePubkey,
  },
  autopilot: {
    status,
    modifyStatus,
    queryScores,
    setScores,
  },
  scheduledSync: {
    checkScheduledSyncWorkStatus,
  },
  scheduledGossipSync: {
    checkScheduledGossipSyncWorkStatus,
  },
} as unknown as ILndMobileInjections;
