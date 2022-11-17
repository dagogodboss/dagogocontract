/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-extraneous-import */
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  PermissionItems,
  PermissionManager,
  Rocket,
  USDC,
  DAI,
} from "../typechain/index";

import { BigNumber, BigNumberish, ContractFactory } from "ethers";
import { poolData } from "./config";
import { BytesLike } from "@ethersproject/bytes";

let rocketContract: Rocket,
  adminRocketInstance: Rocket,
  contributorRocketInstance: Rocket,
  permissionManager: PermissionManager,
  PermissionItemContract: PermissionItems,
  usdcContract: USDC,
  PRTContract: DAI,
  deployer: SignerWithAddress,
  _feeAddress: SignerWithAddress,
  _rocketAdmin: SignerWithAddress,
  contributorOne: SignerWithAddress,
  contributorTwo: SignerWithAddress,
  contributorThree: SignerWithAddress,
  _poolAddress: BytesLike,
  contributorOneUSDC: USDC,
  adminInstanceOfPRT: USDC,
  _scheduleId: BytesLike,
  _distributionScheduleId: BytesLike;

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

const deployTokens = async () => {
  const usdc: ContractFactory = await ethers.getContractFactory("USDC");
  usdcContract = (await usdc.deploy(
    "USDC Stable Coin",
    "USDC",
    BigNumber.from(5000000)
  )) as USDC;
  await usdcContract.deployed();
  contributorOneUSDC = usdcContract.connect(contributorOne);
  await usdcContract.transfer(contributorOne.address, BigNumber.from(5000000));
};

const deployRewardTokens = async () => {
  const rewardToken: ContractFactory = await ethers.getContractFactory("DAI");
  PRTContract = (await rewardToken.deploy(
    "Pool Reward Token",
    "PRT",
    BigNumber.from(5000000)
  )) as DAI;
  await PRTContract.deployed();
  adminInstanceOfPRT = PRTContract.connect(_rocketAdmin);
  await PRTContract.transfer(_rocketAdmin.address, BigNumber.from(5000000));
};

const toUnixTimestamp = async (
  date: string | number | Date
): Promise<BigNumberish> => {
  const dateObj = new Date(date);
  return Math.floor(dateObj.getTime() / 1000);
};
const currentDate = new Date();
const startDate = toUnixTimestamp(currentDate);
const endDate = toUnixTimestamp(currentDate.setDate(currentDate.getDate() + 7));
const deployPermissionItems = async () => {
  const permissionItemFactory: ContractFactory =
    await ethers.getContractFactory("PermissionItems");
  PermissionItemContract =
    (await permissionItemFactory.deploy()) as PermissionItems;
  PermissionItemContract.deployed();
  return PermissionItemContract;
};

before(async () => {
  [
    deployer,
    _rocketAdmin,
    _feeAddress,
    contributorOne,
    contributorTwo,
    contributorThree,
  ] = await ethers.getSigners();
  const permissionItem = await deployPermissionItems();
  permissionManager = await deployPermissionManager(
    permissionItem.address,
    deployer.address
  );
  const RocketFactory = await ethers.getContractFactory("Rocket");
  rocketContract = (await upgrades.deployProxy(RocketFactory, [
    permissionManager.address,
    deployer.address,
    _rocketAdmin.address,
    _feeAddress.address,
  ])) as Rocket;
  await rocketContract.deployed();

  // Copy the instance of the contract for [Admin, Contributor, Receiver,]
  adminRocketInstance = rocketContract.connect(_rocketAdmin);
  contributorRocketInstance = rocketContract.connect(contributorOne);

  // Deploy The ERC20 tokens
  await deployTokens();
  await deployRewardTokens();
});

describe("Rocket Pool", () => {
  describe("Has Rocket being initialize", () => {
    it("should fail with message contract had been initialized", async () => {
      await expect(
        rocketContract.initialize(
          permissionManager.address,
          deployer.address,
          _rocketAdmin.address,
          _feeAddress.address
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });
  describe("Rocket Smart Contract", function () {
    it("Smart Contract should not have zero address", async function () {
      expect(await rocketContract.address).to.not.equal(
        ethers.constants.AddressZero
      );
    });
  });
  describe("check Admin roles", async () => {
    it("Deployer have Default Admin Role For Rocket Contract", async () => {
      expect(
        await rocketContract.hasRole(
          await rocketContract.DEFAULT_ADMIN_ROLE(),
          deployer.address
        )
      ).to.equal(true);
    });
    it("Deployer have Default Admin Role For PERMISSION MANAGER", async () => {
      expect(
        await permissionManager.hasRole(
          await permissionManager.DEFAULT_ADMIN_ROLE(),
          deployer.address
        )
      ).to.equal(true);
    });
    it("can assign role to address", async () => {
      // await permissionManager.setPermissionsAdmin(_rocketAdmin.address);
      await permissionManager.setPermissionsAdmin(deployer.address);
      expect(
        await permissionManager.hasRole(
          await permissionManager.PERMISSIONS_ADMIN_ROLE(),
          deployer.address
        )
      ).to.equal(true);

      await PermissionItemContract.setAdmin(permissionManager.address);

      await permissionManager.createTier(1, "Diamond Tier");
    });
  });
  describe("Create Pool Feature", async () => {
    it("check only rocket admin can create pool", async () => {
      await expect(rocketContract.createPool(poolData)).to.be.revertedWith(
        "Rocket_Admin_ROLE required"
      );
    });

    it("should create pool", async () => {
      const updatePoolDTO = {
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ...poolData,
        _tokens: [contributorOneUSDC.address],
        _poolRewardAddress: PRTContract.address,
      };
      const _poolData = (
        await (await adminRocketInstance.createPool(updatePoolDTO)).wait()
      ).events?.[0];
      _poolAddress = _poolData?.args?.poolId;
      expect(_poolData?.event).to.equal("CreatedPool");
    });
  });
  describe("Distribution Schedule Feature", () => {
    it("only admin can create distribution schedule", async () => {
      await expect(
        rocketContract.createDistributionSchedule(_poolAddress, 0, 0, 30)
      ).to.revertedWith(
        "AccessControl: account 0xe33a8103598efd2f38d2b2bc89cd4f176bde165e is missing role 0xb72b3a91fc43cfd55c7c0304b984a2c2cc43d00fbe824ecb3d7ca6a0b1abd1bb"
      );
    });
    it("Admin can create distribution schedule", async () => {
      const distribution = (
        await (
          await adminRocketInstance.createDistributionSchedule(
            _poolAddress,
            await startDate,
            await endDate,
            30
          )
        ).wait()
      ).events?.[0];
      _distributionScheduleId = distribution?.args?.distributionId;
      await expect(distribution?.event).to.equal("CreatedDistributionSchedule");
    });
  });
  describe("Contribution Schedule", async () => {
    it("only Admin can create a Contribution schedule", async () => {
      await expect(
        rocketContract.createContributionSchedule(
          _poolAddress,
          1,
          1000,
          10000,
          2,
          0,
          0
        )
      ).to.be.revertedWith("must have Rocket Admin role");
    });

    it("should create a contribution schedule ", async () => {
      const schedule = (
        await (
          await adminRocketInstance.createContributionSchedule(
            _poolAddress,
            1,
            1000,
            10000000000,
            2,
            await startDate,
            await endDate
          )
        ).wait()
      ).events?.[0];
      _scheduleId = schedule?.args?.scheduleId;
      expect(schedule?.event).to.equal("CreatedContributionSchedule");
    });
  });
  describe("Claim Token Feature Failure Phase One", async () => {
    it("Can't claim token", async () => {
      await expect(
        contributorRocketInstance.claimPoolRewardToken(
          _poolAddress,
          _scheduleId,
          _distributionScheduleId
        )
      ).to.revertedWith("Pool is active");
    });
  });
  describe("Contribution Feature", async () => {
    let contribution: any;
    before(async () => {
      await permissionManager.assignTier(
        [
          contributorOne.address,
          _rocketAdmin.address,
          contributorTwo.address,
          contributorThree.address,
        ],
        1
      );
      await contributorOneUSDC.approve(
        contributorRocketInstance.address,
        500000000000
      );
      contribution = (
        await (
          await contributorRocketInstance.contribute(
            _poolAddress,
            _scheduleId,
            1000,
            usdcContract.address
          )
        ).wait()
      ).events;
    });

    it("can contribute", async () => {
      const [contributedEvent] = contribution.filter(
        ({ event }: any) => event === "Contributed"
      );
      expect(contributedEvent.event).to.equal("Contributed");
    });

    it("rocket USDC token balance should increase", async () => {
      const balance = await contributorOneUSDC.balanceOf(
        contributorRocketInstance.address
      );
      balance.eq(BigNumber.from(1000 * 0.2));
    });

    it("Fee Address to receive usdc token", async () => {
      const balance = await contributorOneUSDC.balanceOf(_feeAddress.address);
      balance.eq(BigNumber.from(1000 - 1000 * 0.2));
    });
  });
  describe("Withdraw Fund Feature Failure", () => {
    it("Can't withdraw funds from the pool ", async () => {
      await expect(
        adminRocketInstance.withdrawFundToReceiver(_poolAddress)
      ).to.revertedWith("Pool is still active");
    });
  });
  describe("Hit pool target Test", () => {
    it("should emit Pool Target Completed Event", async () => {
      const targetAmount = (poolData._targetAmount as number) - 1000;
      await expect(
        contributorRocketInstance.contribute(
          _poolAddress,
          _scheduleId,
          targetAmount,
          usdcContract.address
        )
      ).to.emit(contributorRocketInstance, "PoolTargetCompleted");
    });
  });
  describe("Claim Token Feature Failure Phase Two", () => {
    it("can't  claim from Pool with no reward token", async () => {
      await expect(
        contributorRocketInstance.claimPoolRewardToken(
          _poolAddress,
          _scheduleId,
          _distributionScheduleId
        )
      ).to.revertedWith("Pool has no reward tokens");
    });
  });
  describe("Withdraw Fund Feature", () => {
    let initBalance: BigNumber;
    it("only admin can withdraw funds from the pool ", async () => {
      await expect(
        rocketContract.withdrawFundToReceiver(_poolAddress)
      ).to.revertedWith("must have Rocket Admin role");
    });
    it("Can withdraw funds from the pool ", async () => {
      initBalance = await usdcContract.balanceOf(adminRocketInstance.address);
      await expect(
        adminRocketInstance.withdrawFundToReceiver(_poolAddress)
      ).to.emit(usdcContract, "Transfer");
    });
    it("pool owner should receives funds from the pool", async () => {
      expect(await usdcContract.balanceOf(poolData._receiver)).to.equal(
        initBalance
      );
    });
  });
  describe("deposit Pool Reward Tokens", () => {
    before(async () => {
      await adminInstanceOfPRT.approve(
        adminRocketInstance.address,
        5000000000000
      );
    });
    it("only admin can deposit reward tokens", async () => {
      await expect(
        rocketContract.depositPoolRewardTokens(_poolAddress)
      ).to.revertedWith("must have Rocket Admin role");
    });

    it("Admin can deposit reward tokens", async () => {
      await expect(
        adminRocketInstance.depositPoolRewardTokens(_poolAddress)
      ).to.emit(PRTContract, "Transfer");
    });

    it("Rocket SC receives the reward tokens", async () => {
      expect(await PRTContract.balanceOf(rocketContract.address)).to.equal(
        poolData._poolRewardTokenAmount
      );
    });
  });
  describe("Claim Token Feature", () => {
    it("contributor can claim pool reward", async () => {
      await expect(
        contributorRocketInstance.claimPoolRewardToken(
          _poolAddress,
          _scheduleId,
          _distributionScheduleId
        )
      ).to.emit(PRTContract, "Transfer");
    });
    it("should increase the contributor Pool reward Balance", async () => {
      expect(await PRTContract.balanceOf(contributorOne.address)).to.equal(
        await (
          await rocketContract.contributions(_scheduleId)
        ).amountToReceive
      );
    });
    it("contributor can claim pool reward", async () => {
      await expect(
        contributorRocketInstance.claimPoolRewardToken(
          _poolAddress,
          _scheduleId,
          _distributionScheduleId
        )
      ).to.revertedWith("double claim found");
    });
  });
});
