//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

/**
 * @title PemissionManagerStorage
 * @author Protofire
 * @dev Storage structure used by PermissionManager contract.
 *
 * All storage must be declared here
 * New storage must be appended to the end
 * Never remove items from this list
 */
abstract contract PermissionManagerStorage {
  bytes32 public constant NULL = 0x00;
  bytes32 public constant PERMISSIONS_ADMIN_ROLE =
    keccak256("PERMISSIONS_ADMIN_ROLE");
  address public permissionItems;
  // Constants for Permissions ID

  uint256 public constant REJECTED_ID = 3;
  uint256 public constant SUSPENDED_ID = 0;
  mapping(uint256 => bytes32) public tiers;
}
