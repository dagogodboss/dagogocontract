/* eslint-disable node/no-unsupported-features/node-builtins */
/* eslint-disable node/no-extraneous-import */
/* eslint-disable @typescript-eslint/no-explicit-any */
import hre from "hardhat";
import path from "path";
import _ from "lodash";
import { promises as fs } from "fs";
import fsExtra from "fs-extra";
import { getChainId, networkNames } from "@openzeppelin/upgrades-core";

export type TestnetData = { [key: string]: { address: string } };

// FIXME: figure out the proper way to add type bindings withoug copypasting the code
export function combinations<Type>(
  collection: Array<Type>,
  n: number
): Array<[Type, Type]> {
  const array = _.values(collection);
  if (array.length < n) {
    return [];
  }
  const recur = (array: any, n: number) => {
    if (--n < 0) {
      return [[]];
    }
    const workingCombinations: any = [];
    array = array.slice();
    while (array.length - n) {
      const value: any = array.shift();
      recur(array, n).forEach((combination: any) => {
        combination.unshift(value);
        workingCombinations.push(combination);
      });
    }
    return workingCombinations;
  };
  return recur(array, n);
}

export async function getDeploymentFile(): Promise<string> {
  const chainId = await getChainId(hre.network.provider);
  const name = networkNames[chainId] ?? `unknown-${chainId}`;
  return path.join(`deployments/${name}.json`);
}

async function getOZFile() {
  const chainId = await getChainId(hre.network.provider);
  const name = networkNames[chainId] ?? `unknown-${chainId}`;
  return path.join(`.openzeppelin/${name}.json`);
}

export async function getTestnetDataFile(): Promise<string> {
  const chainId = await getChainId(hre.network.provider);
  const name = networkNames[chainId] ?? `unknown-${chainId}`;
  return path.join(`deployments/${name}-testnet-data.json`);
}

export async function writeTestnetData(data: TestnetData): Promise<void> {
  const file = await getTestnetDataFile();
  await fsExtra.ensureFile(file);
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

async function readFile(filename: string): Promise<any> {
  // eslint-disable-next-line no-useless-catch
  try {
    return JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (e) {
    throw e;

    // if (e.code === 'ENOENT') {
    //   return {};
    // } else {
    //   throw e;
    // }
  }
}

export async function readDeploymentFile(): Promise<any> {
  return readFile(await getDeploymentFile());
}

export async function readOZFile(): Promise<any> {
  return readFile(await getOZFile());
}

export async function readTestnetDataFile(): Promise<TestnetData> {
  return readFile(await getTestnetDataFile()) as unknown as TestnetData;
}
