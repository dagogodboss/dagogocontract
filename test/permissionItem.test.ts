/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Signer, ContractFactory } from "ethers";
import { expect } from "chai";
import { PermissionItems } from "../typechain";
import Reverter from "./utils/reverter";

let deployer: Signer;
let UserOne: Signer;
let UserTwo: Signer;
let UserThree: Signer;

let deployerAddress: string;
let UserOneAddress: string;
let UserTwoAddress: string;
let UserThreeAddress: string;

let permissionItemsContract: PermissionItems;
let permissionItemsContractUserOne: PermissionItems;
let permissionItemsContractUserTwo: PermissionItems;
let permissionItemsContractUserThree: PermissionItems;

let PermissionItemsFactory: ContractFactory;

let MINTER_ROLE: string;
let BURNER_ROLE: string;
let DEFAULT_ADMIN_ROLE: string;

describe("PermissioningItems", function () {
  const reverter = new Reverter();

  before(async () => {
    [deployer, UserOne, UserTwo, UserThree] = await ethers.getSigners();
    [deployerAddress, UserOneAddress, UserTwoAddress, UserThreeAddress] =
      await Promise.all([
        deployer.getAddress(),
        UserOne.getAddress(),
        UserTwo.getAddress(),
        UserThree.getAddress(),
      ]);

    PermissionItemsFactory = await ethers.getContractFactory("PermissionItems");

    await reverter.snapshot();
  });

  describe("deployment", () => {
    it("should deploy and set deployer as DEFAULT_ADMIN_ROLE", async () => {
      permissionItemsContract =
        (await PermissionItemsFactory.deploy()) as PermissionItems;
      await permissionItemsContract.deployed();

      DEFAULT_ADMIN_ROLE = await permissionItemsContract.DEFAULT_ADMIN_ROLE();
      expect(
        await permissionItemsContract.hasRole(
          DEFAULT_ADMIN_ROLE,
          deployerAddress
        )
      ).to.equal(true);
    });
  });

  describe("#setAdmin - #revokeAdmin", () => {
    before(async () => {
      await permissionItemsContract.setAdmin(UserOneAddress);

      permissionItemsContractUserOne = permissionItemsContract.connect(UserOne);
      permissionItemsContractUserTwo = permissionItemsContract.connect(UserTwo);

      MINTER_ROLE = await permissionItemsContract.MINTER_ROLE();
      BURNER_ROLE = await permissionItemsContract.BURNER_ROLE();

      await reverter.snapshot();
    });

    it("should not allow to call setAdmin to a non role admin", async () => {
      await expect(
        permissionItemsContractUserOne.setAdmin(UserTwoAddress)
      ).to.be.revertedWith(
        "AccessControl: account 0x0d2738a9f0fde50cff0944b4b57c23d192b2a51a is missing role 0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("should allow to call setAdmin to a role admin", async () => {
      await permissionItemsContract.setAdmin(UserTwoAddress);

      expect(
        await permissionItemsContract.hasRole(MINTER_ROLE, UserTwoAddress)
      ).to.equal(true);
      expect(
        await permissionItemsContract.hasRole(BURNER_ROLE, UserTwoAddress)
      ).to.equal(true);
    });

    it("should not allow to call revokeAdmin to a non role admin", async () => {
      await expect(
        permissionItemsContractUserOne.revokeAdmin(UserTwoAddress)
      ).to.be.revertedWith(
        "AccessControl: account 0x0d2738a9f0fde50cff0944b4b57c23d192b2a51a is missing role 0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("should allow to call revokeAdmin to a role admin", async () => {
      await permissionItemsContract.revokeAdmin(UserTwoAddress);

      expect(
        await permissionItemsContract.hasRole(MINTER_ROLE, UserTwoAddress)
      ).to.equal(false);
      expect(
        await permissionItemsContract.hasRole(BURNER_ROLE, UserTwoAddress)
      ).to.equal(false);
    });
  });

  describe("mint", () => {
    beforeEach(async () => {
      await reverter.revert();
    });

    it("should not allow to call mint to a non MINTER", async () => {
      await expect(
        permissionItemsContractUserTwo.mint(UserThreeAddress, 1, 1)
      ).to.be.revertedWith("PermissionItems: must have minter role to mint");
    });

    it("MINTER should be able to mint", async () => {
      await permissionItemsContractUserOne.mint(UserThreeAddress, 1, 1);
      expect(
        await permissionItemsContract.balanceOf(UserThreeAddress, 1)
      ).to.equal("1");
    });

    it("should not allow to call mintBatch to a non MINTER", async () => {
      await expect(
        permissionItemsContractUserTwo.mintBatch(
          UserThreeAddress,
          [1, 2],
          [1, 1]
        )
      ).to.be.revertedWith("PermissionItems: must have minter role to mint");
    });

    it("MINTER should be able to mintBatch", async () => {
      await permissionItemsContractUserOne.mintBatch(
        UserThreeAddress,
        [1, 2],
        [1, 1]
      );

      const balances = await permissionItemsContract.balanceOfBatch(
        [UserThreeAddress, UserThreeAddress],
        [1, 2]
      );
      expect(balances[0]).to.equal("1");
      expect(balances[1]).to.equal("1");
    });
  });

  describe("burn", () => {
    before(async () => {
      await reverter.revert();

      await permissionItemsContractUserOne.mintBatch(
        UserThreeAddress,
        [1, 2],
        [1, 1]
      );

      await reverter.snapshot();
    });

    beforeEach(async () => {
      await reverter.revert();
    });

    it("should not allow to call burn to a non BURNER", async () => {
      await expect(
        permissionItemsContractUserTwo.burn(UserThreeAddress, 1, 1)
      ).to.be.revertedWith("PermissionItems: must have burner role to burn");
    });

    it("BURNER should be able to burn", async () => {
      await permissionItemsContractUserOne.burn(UserThreeAddress, 1, 1);
      expect(
        await permissionItemsContract.balanceOf(UserThreeAddress, 1)
      ).to.equal("0");
    });

    it("should not allow to call burnBatch to a non BURNER", async () => {
      await expect(
        permissionItemsContractUserTwo.burnBatch(
          UserThreeAddress,
          [1, 2],
          [1, 1]
        )
      ).to.be.revertedWith("PermissionItems: must have burner role to burn");
    });

    it("BURNER should be able to burnBatch", async () => {
      await permissionItemsContractUserOne.burnBatch(
        UserThreeAddress,
        [1, 2],
        [1, 1]
      );

      const balances = await permissionItemsContract.balanceOfBatch(
        [UserThreeAddress, UserThreeAddress],
        [1, 2]
      );
      expect(balances[0]).to.equal("0");
      expect(balances[1]).to.equal("0");
    });
  });

  describe("non-transferables tokens", () => {
    before(async () => {
      await reverter.revert();
      permissionItemsContractUserThree =
        permissionItemsContract.connect(UserThree);
    });

    it("should not allow to call setApprovalForAll", async () => {
      const approved = await permissionItemsContract.isApprovedForAll(
        UserThreeAddress,
        UserTwoAddress
      );
      expect(approved).to.equal(false);

      await expect(
        permissionItemsContractUserThree.setApprovalForAll(UserTwoAddress, true)
      ).to.be.revertedWith("disabled");

      const approvedAfter = await permissionItemsContract.isApprovedForAll(
        UserThreeAddress,
        UserTwoAddress
      );
      expect(approvedAfter).to.equal(false);
    });

    it("should not allow to call safeTransferFrom", async () => {
      const balance = await permissionItemsContract.balanceOf(
        UserThreeAddress,
        1
      );
      expect(balance).to.equal("1");

      await expect(
        permissionItemsContractUserThree.safeTransferFrom(
          UserThreeAddress,
          UserTwoAddress,
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("disabled");

      const balanceAfter = await permissionItemsContract.balanceOf(
        UserThreeAddress,
        1
      );
      expect(balanceAfter).to.equal("1");
    });

    it("should not allow to call safeBatchTransferFrom", async () => {
      const balances = await permissionItemsContract.balanceOfBatch(
        [UserThreeAddress, UserThreeAddress],
        [1, 2]
      );
      expect(balances[0]).to.equal("1");
      expect(balances[1]).to.equal("1");

      await expect(
        permissionItemsContractUserThree.safeBatchTransferFrom(
          UserThreeAddress,
          UserTwoAddress,
          [1, 2],
          [1, 1],
          "0x"
        )
      ).to.be.revertedWith("disabled");

      const balancesAfter = await permissionItemsContract.balanceOfBatch(
        [UserThreeAddress, UserThreeAddress],
        [1, 2]
      );
      expect(balancesAfter[0]).to.equal("1");
      expect(balancesAfter[1]).to.equal("1");
    });
  });
});
