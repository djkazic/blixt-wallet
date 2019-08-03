import { NativeModules } from "react-native";
import { Thunk, thunk, Action, action } from "easy-peasy";
import { SQLiteDatabase } from "react-native-sqlite-storage";

import { lightning, ILightningModel } from "./Lightning";
import { transaction, ITransactionModel } from "./Transaction";
import { channel, IChannelModel } from "./Channel";
import { send, ISendModel } from "./Send";

import { clearApp, setupApp, getWalletCreated, StorageItem, getItemObject, setItemObject } from "../storage/app";
import { openDatabase, setupInitialSchema, deleteDatabase, dropTables } from "../storage/database/sqlite";
import { clearTransactions } from "../storage/database/transaction";
import { genSeed, initWallet } from "../lndmobile/wallet";
import { IReceiveModel, receive } from "./Receive";
import { IOnChainModel, onChain } from "./OnChain";

const { LndMobile } = NativeModules;

interface ICreateWalletPayload {
  password: string;
}

export interface IStoreModel {
  initializeApp: Thunk<IStoreModel, void, any, IStoreModel>;
  clearApp: Thunk<IStoreModel>;
  clearTransactions: Thunk<IStoreModel>;
  resetDb: Thunk<IStoreModel>;
  setDb: Action<IStoreModel, SQLiteDatabase>;
  setAppReady: Action<IStoreModel, boolean>;
  setWalletCreated: Action<IStoreModel, boolean>;

  createWallet: Thunk<IStoreModel, ICreateWalletPayload>;

  db?: SQLiteDatabase;
  appReady: boolean;
  walletCreated: boolean;

  lightning: ILightningModel;
  transaction: ITransactionModel;
  channel: IChannelModel;
  send: ISendModel;
  receive: IReceiveModel;
  onChain: IOnChainModel;
}

const model: IStoreModel = {
  initializeApp: thunk(async (actions, _, { getState, dispatch }) => {
    if (getState().appReady) {
      console.warn("App already initialized");
      return;
    }

    const db = await openDatabase();
    actions.setDb(db);
    if (!await getItemObject(StorageItem.app)) {
      console.log("Initializing app for the first time");
      await setupApp();
      console.log("Initializing db for the first time");
      await setupInitialSchema(db);
      console.log("Writing lnd.conf");
      await NativeModules.LndMobile.writeConfigFile();
      dispatch.lightning.setFirstSync(true);
    }

    actions.setWalletCreated(await getWalletCreated());

    try {
      console.log(await NativeModules.LndMobile.init());
      const status = await NativeModules.LndMobile.checkStatus();
      if ((status & LndMobile.STATUS_PROCESS_STARTED) !== LndMobile.STATUS_PROCESS_STARTED) {
        console.log("lnd not started, starting lnd");
        console.log(await NativeModules.LndMobile.startLnd());
      }
      actions.setAppReady(true);
    }
    catch (e) {
      console.log("Exception", e);
      throw e;
    }

    console.log("App initialized");
    return true;
  }),

  clearApp: thunk(async () => {
    await clearApp();
    await deleteDatabase();
  }),

  clearTransactions: thunk(async (_, _2, { getState }) => {
    await clearTransactions(getState().db!);
  }),

  resetDb: thunk(async (_, _2, { getState }) => {
    const { db } = getState();
    if (db) {
      await dropTables(db);
      await setupInitialSchema(db);
    }
  }),

  createWallet: thunk(async (actions, payload) => {
    const seed = await genSeed();
    const wallet = await initWallet(seed.cipherSeedMnemonic, payload.password);
    await setItemObject(StorageItem.walletCreated, true);
    actions.setWalletCreated(true);
    return wallet;
  }),

  setWalletCreated: action((state, payload) => { state.walletCreated = payload; }),
  setDb: action((state, db) => { state.db = db; }),
  setAppReady: action((state, value) => { state.appReady = value; }),

  appReady: false,
  walletCreated: false,

  lightning,
  transaction,
  channel,
  send,
  receive,
  onChain,
};

export default model;
