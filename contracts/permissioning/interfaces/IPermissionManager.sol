//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;

interface IPermissionManager {
  
  function userHasItem(address _user, uint256 itemId)
    external
    view
    returns (bool);

  function tierExists(uint256 itemId) external view returns(bool);
}
