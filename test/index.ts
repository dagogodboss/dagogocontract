import { expect } from "chai";
import { ethers } from "hardhat";

describe("Rocket Smart Contract", function () {
  it("Should return the new greeting once it's changed", async function () {
    const Rocket = await ethers.getContractFactory("Rocket");
    const rocket = await Rocket.deploy();
    await rocket.deployed();
    expect(await rocket.address).to.not.equal(ethers.constants.AddressZero);
  });
});
