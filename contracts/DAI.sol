// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DAI is ERC20 {
    string  private _token_name;
    string  private _token_symbol;
    constructor(string memory _name, string memory sym, uint256 initialSupply) ERC20(_name, sym) {
        _token_name = _name;
        _token_symbol = sym;
        _mint(msg.sender, initialSupply);
    }
}