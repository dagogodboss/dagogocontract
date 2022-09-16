import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PermissionItems, PermissionManager, Rocket } from "../typechain/index";
import { ContractFactory } from "ethers";

let rocketContract: Rocket,
  deployer: SignerWithAddress,
  _feeAddress: SignerWithAddress,
  _rocketAdmin: SignerWithAddress;

const deployPermissionManager = async (
  permissionItem: any,
  deployerAddress: string
) => {
  const PermissionFactory: ContractFactory = await ethers.getContractFactory(
    "PermissionManager"
  );
  const permissionManager: PermissionManager = (await upgrades.deployProxy(
    PermissionFactory,
    [permissionItem, deployerAddress]
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

before(async () => {
  [deployer, _rocketAdmin, _feeAddress] = await ethers.getSigners();
  const permissionItem = await deployPermissionItems();
  const permissionManager = await deployPermissionManager(
    permissionItem.address,
    deployer.address
  );
  console.log(`Deploying permission ${permissionManager.address}`);
  const RocketFactory = await ethers.getContractFactory("Rocket");
  rocketContract = (await upgrades.deployProxy(RocketFactory, [
    permissionManager.address,
    deployer.address,
    _rocketAdmin.address,
    _feeAddress.address,
  ])) as Rocket;
  await rocketContract.deployed();
});

describe("Rocket Smart Contract", function () {
  it("Smart Contract should not have zero address", async function () {
    expect(await rocketContract.address).to.not.equal(
      ethers.constants.AddressZero
    );
  });
});
describe("", () => {
  it("", () => { });
});
describe("", () => {
  it("", () => { });
});
describe("", () => {
  it("", () => { });
});
