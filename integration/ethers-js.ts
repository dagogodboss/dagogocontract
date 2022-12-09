/* eslint-disable node/no-unpublished-import */
/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable node/no-extraneous-import */
import { ethers, Contract, ContractInterface, Signer } from "ethers";
import { Provider } from "@ethersproject/providers";
import Goerli from "../deployments/goerli.json";
import { createPool, poolData } from "./../test/config/index";
import { TransactionResponse } from "@ethersproject/abstract-provider";

const privateKey =
  process.env.PRIVATE_KEY ||
  "0x4bb52791ad24eaeccadb775d4a3bf00316a184a8ba523b16003f56a93f25ebb7";
console.log(privateKey);
const { rocket } = Goerli;
export const provider = (): Provider => {
  return new ethers.providers.InfuraProvider("goerli");
};

export const signer = (): Signer => {
  return new ethers.Wallet(privateKey, provider());
};

export const contractInstance = (
  address: string,
  abi: ContractInterface
): Contract => {
  return new ethers.Contract(address, abi, signer());
};

interface CreatePoolResponse {
  poolId: string;
  poolTargetAmount: any;
  receiver: string;
  tokens: string[];
}
const createPoolDTO: createPool = poolData;

(async (): Promise<CreatePoolResponse> => {
  //   initialize smart contract
  const rocketInstance = contractInstance(rocket.address, rocket.abi);
  //   call function that needs to be called
  const transaction: any = await rocketInstance.createPool(createPoolDTO, {
    gasLimit: 2100000,
    gasPrice: 8000000000,
  });
  //   wait for transactionResponse
  const transactionReceipt = await transaction.wait(2);
  const [event] = transactionReceipt?.events.filter(
    (event: any) => event.event === "CreatedPool"
  );
  const {
    args: { poolId, poolTargetAmount, receiver, tokens },
  } = event;
  console.log(poolId, poolTargetAmount, receiver, tokens);
  return { poolId, poolTargetAmount, receiver, tokens };
})();
