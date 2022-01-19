//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;

contract IPermissionManager {
  function rejectUser(UserProxy[] memory _usersProxies) external;

  function userHasItem(address _user, uint256 itemId)
    external
    view
    returns (bool);
}
