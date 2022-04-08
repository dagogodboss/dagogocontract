/* eslint-disable node/no-unsupported-features/es-syntax */
import hre, { ethers, upgrades } from "hardhat";
import { Rocket, PermissionManager, PermissionItems } from "../typechain";
import { ContractFactory } from "ethers";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import PermissionManagerAbi from "../artifacts/contracts/permissioning/PermissionManager.sol/PermissionManager.json";
import RocketSmartContract from "../artifacts/contracts/Rocket.sol/Rocket.json";
import permissionItemAbi from "../artifacts/contracts/permissioning/PermissionItems.sol/PermissionItems.json";
import path from "path";
// eslint-disable-next-line node/no-extraneous-import
import { getChainId, networkNames } from "@openzeppelin/upgrades-core";

import fsExtra from "fs-extra";
import { promises as fs } from "fs";

import ora, { Ora } from "ora";

let spinner: Ora;

const deployPermissionManager = async (
  permissionItem: any,
  deployerAddress: string
) => {
  const PermissionFactory: ContractFactory = await ethers.getContractFactory(
    "PermissionManager"
  );
  const permissionManager: PermissionManager = (await upgrades.deployProxy(
    PermissionFactory,
    [permissionItem.address, deployerAddress]
  )) as PermissionManager;
  permissionManager.deployed();
  return permissionManager;
};

const deployPermissionItems = async () => {
  const permissionItemFactory: ContractFactory =
    await ethers.getContractFactory("PermissionItems");
  const PermissionItemContract: PermissionItems =
    (await permissionItemFactory.deploy()) as PermissionItems;
  PermissionItemContract.deployed();
  return PermissionItemContract;
};

async function main() {
  let deploymentData = await read();
  const [deployer] = await ethers.getSigners();
  const [deployerAddress] = await Promise.all([deployer.getAddress()]);

  startLog("Deploying permissionItem ERC1155 NFT Smart Contract");
  const permissionItem = await deployPermissionItems();
  deploymentData = {
    ...deploymentData,
    permissionItem: {
      address: permissionItem.address,
      abi: permissionItemAbi.abi,
      deployTransaction: await getReceipt(permissionItem.deployTransaction),
    },
  };
  await write(deploymentData);
  stopLog(
    `permissionItem deployed - txHash: ${permissionItem.deployTransaction.hash} - '\n address: ${permissionItem.address}`
  );

  startLog("Deploying permissionManager Smart Contract");
  const permissionManager = await deployPermissionManager(
    permissionItem,
    deployerAddress
  );
  deploymentData = {
    ...deploymentData,
    permissionManager: {
      address: permissionManager.address,
      abi: PermissionManagerAbi.abi,
      deployTransaction: await getReceipt(permissionManager.deployTransaction),
    },
  };
  await write(deploymentData);
  stopLog(
    `permissionManager deployed - txHash: ${permissionManager.deployTransaction.hash} - '\n address: ${permissionManager.address}`
  );

  startLog("Deploying Rocket Smart Contract");
  const RocketContract: ContractFactory = await ethers.getContractFactory(
    "Rocket"
  );
  const rocket: Rocket = (await RocketContract.deploy(
    permissionManager.address
  )) as Rocket;
  await rocket.deployed();
  deploymentData = {
    ...deploymentData,
    rocket: {
      address: rocket.address,
      abi: RocketSmartContract.abi,
      deployTransaction: await getReceipt(rocket.deployTransaction),
    },
  };
  stopLog(
    `rocket deployed - txHash: ${rocket.deployTransaction.hash} - '\n address: ${rocket.address}`
  );
  await write(deploymentData);
}

async function read(): Promise<any> {
  const deploymentsFile = await getDeploymentFile();

  try {
    return JSON.parse(await fs.readFile(deploymentsFile, "utf8"));
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return {};
    } else {
      throw e;
    }
  }
}

async function write(data: any): Promise<void> {
  const deploymentsFile = await getDeploymentFile();
  await fsExtra.ensureFile(deploymentsFile);
  await fs.writeFile(deploymentsFile, JSON.stringify(data, null, 2) + "\n");
}

async function getDeploymentFile() {
  const chainId = await getChainId(hre.network.provider);
  const name = networkNames[chainId] ?? `unknown-${chainId}`;
  return path.join(`deployments/${name}.json`);
}

function startLog(message: string) {
  spinner = ora().start(message);
}

function updateLog(message: string) {
  spinner.text = message;
}

function stopLog(message: string) {
  spinner.succeed(message);
}

async function getReceipt(transactionResponse: TransactionResponse) {
  const receipt = await transactionResponse.wait();
  return {
    ...transactionResponse,
    ...receipt,
    // gasPrice: transactionResponse.gasPrice.toString(),
    gasLimit: transactionResponse.gasLimit.toString(),
    value: transactionResponse.value.toString(),
    gasUsed: receipt.gasUsed.toString(),
    cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
  };
}
main().catch((error) => {
  console.error(`The Boss ${error}`);
  process.exitCode = 1;
});
