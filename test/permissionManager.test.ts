/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-unsupported-features/es-syntax */
/** @format */

import { ethers, upgrades } from "hardhat";
import { Signer, ContractFactory } from "ethers";
import { expect } from "chai";
import { PermissionItems, PermissionManager } from "../typechain";
import Reverter from "./utils/reverter";

let deployer: Signer;
let nonAdmin: Signer;
let user: Signer;

let deployerAddress: string;
let userAddress: string;

let permissionManagerContract: PermissionManager;
let permissionManagerContractNonAdmin: PermissionManager;
let permissionItemsContract: PermissionItems;

let PermissionItemsFactory: ContractFactory;
let PermissionManagerFactory: ContractFactory;

let DEFAULT_ADMIN_ROLE: string;
let PERMISSIONS_ADMIN_ROLE: string;

describe("Permission Manager", () => {
  const reverter = new Reverter();

  before(async () => {
    [deployer, nonAdmin, user] = await ethers.getSigners();
    [deployerAddress, userAddress] = await Promise.all([
      deployer.getAddress(),
      user.getAddress(),
    ]);

    PermissionItemsFactory = await ethers.getContractFactory("PermissionItems");
    permissionItemsContract =
      (await PermissionItemsFactory.deploy()) as PermissionItems;
    await permissionItemsContract.deployed();

    PermissionManagerFactory = await ethers.getContractFactory(
      "PermissionManager"
    );

    await reverter.snapshot();
  });

  describe("Permission Manager work", () => {
    it("description", async () => {});
  });

  describe("initialization", () => {
    it("should not be able to initialize with permissionItems zero address", async () => {
      let reverted = false;
      try {
        permissionManagerContract = (await upgrades.deployProxy(
          PermissionManagerFactory,
          [ethers.constants.AddressZero, deployerAddress]
        )) as PermissionManager;
      } catch {
        reverted = true;
      }

      expect(reverted).to.eq(true);
    });
    it("should not be able to initialize with admin zero address", async () => {
      let reverted = false;
      try {
        permissionManagerContract = (await upgrades.deployProxy(
          PermissionManagerFactory,
          [permissionItemsContract.address, ethers.constants.AddressZero]
        )) as PermissionManager;
      } catch {
        reverted = true;
      }

      expect(reverted).to.eq(true);
    });

    it("should be able to initialize with permissionItems and admin non zero address", async () => {
      let reverted = true;
      try {
        permissionManagerContract = (await upgrades.deployProxy(
          PermissionManagerFactory,
          [permissionItemsContract.address, deployerAddress]
        )) as PermissionManager;
        reverted = false;
      } catch {
        reverted = true;
      }

      expect(reverted).to.eq(false);
      await reverter.snapshot();
    });

    it("should set permissionItems and admin upon initialization", async () => {
      const permissionItems = await permissionManagerContract.permissionItems();
      expect(permissionItems).to.eq(permissionItemsContract.address);

      DEFAULT_ADMIN_ROLE = await permissionManagerContract.DEFAULT_ADMIN_ROLE();
      expect(
        await permissionManagerContract.hasRole(
          DEFAULT_ADMIN_ROLE,
          deployerAddress
        )
      ).to.equal(true);
    });
  });

  describe("#setPermissionItems", () => {
    let permissionItems2Contract: PermissionItems;

    before("", async () => {
      permissionItems2Contract =
        (await PermissionItemsFactory.deploy()) as PermissionItems;
      await permissionItems2Contract.deployed();

      permissionManagerContractNonAdmin =
        permissionManagerContract.connect(nonAdmin);

      await reverter.snapshot();
    });
    beforeEach(async () => {
      await reverter.revert();
    });

    it("non admin should not be able to call setPermissionItems", async () => {
      await expect(
        permissionManagerContractNonAdmin.setPermissionItems(
          permissionItems2Contract.address
        )
      ).to.be.revertedWith("must have default admin role");
    });

    it("admin should not be able to call setPermissionItems with zero address", async () => {
      await expect(
        permissionManagerContract.setPermissionItems(
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("_permissionItems is the zero address");
    });

    it("admin should be able to call setPermissionItems with non zero address", async () => {
      await permissionManagerContract.setPermissionItems(
        permissionItems2Contract.address
      );

      const permissionItems = await permissionManagerContract.permissionItems();
      expect(permissionItems).to.eq(permissionItems2Contract.address);
    });
  });

  describe("#setPermissionsAdmin", () => {
    beforeEach(async () => {
      await reverter.revert();
    });

    it("non admin should not be able to call setPermissionsAdmin", async () => {
      await expect(
        permissionManagerContractNonAdmin.setPermissionsAdmin(deployerAddress)
      ).to.be.revertedWith("must have default admin role");
    });

    it("admin should not be able to call setPermissionsAdmin with zero address", async () => {
      await expect(
        permissionManagerContract.setPermissionsAdmin(
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("_permissionsAdmin is the zero address");
    });

    it("admin should be able to call setPermissionsAdmin with non zero address", async () => {
      await permissionManagerContract.setPermissionsAdmin(deployerAddress);

      PERMISSIONS_ADMIN_ROLE =
        await permissionManagerContract.PERMISSIONS_ADMIN_ROLE();
      expect(
        await permissionManagerContract.hasRole(
          PERMISSIONS_ADMIN_ROLE,
          deployerAddress
        )
      ).to.equal(true);
    });
  });

  describe("#assingTier", () => {
    before("", async () => {
      await reverter.revert();

      await permissionItemsContract.setAdmin(permissionManagerContract.address);
      await permissionManagerContract.setPermissionsAdmin(deployerAddress);
      await permissionManagerContract.createTier(1, "Diamond Tier");

      await reverter.snapshot();
    });

    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call assign Tier", async () => {
      await expect(
        permissionManagerContractNonAdmin.assignTier([userAddress], 1)
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call assign Tier", async () => {
      await permissionManagerContract.assignTier([userAddress], 1);

      expect(await permissionManagerContract.userHasItem(userAddress, 1)).to.eq(
        true
      );
    });

    it("PermissionsAdmin should not be able to call assign Tier for the same user twice", async () => {
      await permissionManagerContract.assignTier([userAddress], 1);
      expect(await permissionManagerContract.userHasItem(userAddress, 1)).to.eq(
        true
      );

      await expect(
        permissionManagerContract.assignTier([userAddress], 1)
      ).to.be.revertedWith(
        "PermissionManager: Address already has Tier assigned"
      );
    });
  });

  describe("#suspendUser", () => {
    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call suspendUser", async () => {
      await expect(
        permissionManagerContractNonAdmin.suspendUser([userAddress])
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call suspendUser", async () => {
      await permissionManagerContract.suspendUser([userAddress]);

      expect(await permissionManagerContract.isSuspended(userAddress)).to.eq(
        true
      );
    });

    it("PermissionsAdmin should be able to call suspendUser for user and proxy", async () => {
      await permissionManagerContract.suspendUser([userAddress]);

      expect(await permissionManagerContract.isSuspended(userAddress)).to.eq(
        true
      );
      expect(await permissionManagerContract.isSuspended(userAddress)).to.eq(
        true
      );
    });

    it("PermissionsAdmin should not be able to call suspendUser for the same user twice", async () => {
      await permissionManagerContract.suspendUser([userAddress]);
      expect(await permissionManagerContract.isSuspended(userAddress)).to.eq(
        true
      );

      await expect(
        permissionManagerContract.suspendUser([userAddress])
      ).to.be.revertedWith("PermissionManager: Address is already suspended");
    });
  });

  describe("#rejectUser", () => {
    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call rejectUser", async () => {
      await expect(
        permissionManagerContractNonAdmin.rejectUser([userAddress])
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call rejectUser", async () => {
      await permissionManagerContract.rejectUser([userAddress]);

      expect(await permissionManagerContract.isRejected(userAddress)).to.eq(
        true
      );
    });

    it("PermissionsAdmin should be able to call rejectUser for user and proxy", async () => {
      await permissionManagerContract.rejectUser([userAddress]);

      expect(await permissionManagerContract.isRejected(userAddress)).to.eq(
        true
      );
      expect(await permissionManagerContract.isRejected(userAddress)).to.eq(
        true
      );
    });

    it("PermissionsAdmin should not be able to call rejectUser for the same user twice", async () => {
      await permissionManagerContract.rejectUser([userAddress]);
      expect(await permissionManagerContract.isRejected(userAddress)).to.eq(
        true
      );

      await expect(
        permissionManagerContract.rejectUser([userAddress])
      ).to.be.revertedWith("PermissionManager: Address is already rejected");
    });
  });

  describe("#revokeTier", () => {
    before("", async () => {
      await reverter.revert();
      await permissionManagerContract.createTier(1, "Diamond");
      await permissionManagerContract.assignTier([userAddress], 1);

      await reverter.snapshot();
    });

    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call revokeTier1", async () => {
      await expect(
        permissionManagerContractNonAdmin.revokeTier([userAddress], 1)
      ).to.be.revertedWith("must have permissions admin role");
    });
  });

  describe("#unsuspendUser", () => {
    before("", async () => {
      await reverter.revert();

      await permissionManagerContract.suspendUser([userAddress]);

      await reverter.snapshot();
    });

    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call unsuspendUser", async () => {
      await expect(
        permissionManagerContractNonAdmin.unsuspendUser([userAddress])
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call unsuspendUser for user", async () => {
      await permissionManagerContract.unsuspendUser([userAddress]);

      expect(await permissionManagerContract.isSuspended(userAddress)).to.eq(
        false
      );
    });

    it("PermissionsAdmin should not be able to call unsuspendUser for the same user twice", async () => {
      await permissionManagerContract.unsuspendUser([userAddress]);
      expect(await permissionManagerContract.isSuspended(userAddress)).to.eq(
        false
      );

      await expect(
        permissionManagerContract.unsuspendUser([userAddress])
      ).to.be.revertedWith(
        "PermissionManager: Address is not currently suspended"
      );
    });
  });

  describe("#unRejectUser", () => {
    before("", async () => {
      await reverter.revert();

      await permissionManagerContract.rejectUser([userAddress]);

      await reverter.snapshot();
    });

    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call unRejectUser", async () => {
      await expect(
        permissionManagerContractNonAdmin.unRejectUser([userAddress])
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call unRejectUser for user", async () => {
      await permissionManagerContract.unRejectUser([userAddress]);

      expect(await permissionManagerContract.isRejected(userAddress)).to.eq(
        false
      );
    });

    it("PermissionsAdmin should not be able to call unRejectUser for the same user twice", async () => {
      await permissionManagerContract.unRejectUser([userAddress]);
      expect(await permissionManagerContract.isRejected(userAddress)).to.eq(
        false
      );

      await expect(
        permissionManagerContract.unRejectUser([userAddress])
      ).to.be.revertedWith(
        "PermissionManager: Address is not currently rejected"
      );
    });
  });

  describe("#assignItem", () => {
    before(async () => {
      await reverter.revert();
      await permissionManagerContract.createTier(2, "Super Tier");
      await reverter.snapshot();
    });
    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call assignItem", async () => {
      await expect(
        permissionManagerContractNonAdmin.assignItem(2, [userAddress])
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call assignItem for account", async () => {
      await permissionManagerContract.assignItem(2, [userAddress]);

      expect(await permissionItemsContract.balanceOf(userAddress, 2)).to.eq(1);
    });

    it("PermissionsAdmin should not be able to call assignItem for the same account and item", async () => {
      await permissionManagerContract.assignItem(2, [userAddress]);

      await expect(
        permissionManagerContract.assignItem(2, [userAddress])
      ).to.be.revertedWith("PermissionManager: Account is assigned with item");
    });
  });

  describe("#removeItem", () => {
    before(async () => {
      await reverter.revert();
      await permissionManagerContract.createTier(1, "Champ Tier");

      await reverter.snapshot();
    });

    beforeEach(async () => {
      await reverter.revert();
    });

    it("non PermissionsAdmin should not be able to call removeItem", async () => {
      await expect(
        permissionManagerContractNonAdmin.removeItem(1, [userAddress])
      ).to.be.revertedWith("must have permissions admin role");
    });

    it("PermissionsAdmin should be able to call removeItem for account", async () => {
      await permissionManagerContract.removeItem(1, [userAddress]);

      expect(await permissionItemsContract.balanceOf(userAddress, 1)).to.eq(0);
    });

    it("PermissionsAdmin should not be able to call removeItem for the same account and item", async () => {
      await permissionManagerContract.removeItem(1, [userAddress]);

      await expect(
        permissionManagerContract.removeItem(1, [userAddress])
      ).to.be.revertedWith(
        "PermissionManager: Account is not assigned with item"
      );
    });
  });
});
