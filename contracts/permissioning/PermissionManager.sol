//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./PermissionItems.sol";
import "./PermissionManagerStorage.sol";

/**
 * @title PermissionManager
 * @author Protofire
 * @dev Provide tier based permissions assignments and revoking functions.
 */
contract PermissionManager is
  Initializable,
  AccessControlUpgradeable,
  PermissionManagerStorage
{
  struct UserProxy {
    address user;
    address proxy;
  }

  /**
   * @dev Emitted when `permissionItems` address is set.
   */
  event PermissionItemsSet(address indexed newPermissions);

  /**
   * @dev Initalize the contract.
   *
   * Sets ownership to the account that deploys the contract.
   *
   * Requirements:
   *
   * - `_permissionItems` should not be the zero address.
   *
   * @param _permissionItems The address of the new Pemissions module.
   */
  function initialize(address _permissionItems, address _admin)
    public
    initializer
  {
    require(
      _permissionItems != address(0),
      "_permissionItems is the zero address"
    );
    require(_admin != address(0), "_admin is the zero address");
    permissionItems = _permissionItems;

    __AccessControl_init();

    _setupRole(DEFAULT_ADMIN_ROLE, _admin);

    emit PermissionItemsSet(permissionItems);
  }

  /**
   * @dev Throws if called by some address without DEFAULT_ADMIN_ROLE.
   */
  modifier onlyAdmin() {
    require(
      hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
      "must have default admin role"
    );
    _;
  }

  /**
   * @dev Throws if called by some address without PERMISSIONS_ADMIN_ROLE.
   */
  modifier onlyPermissionsAdmin() {
    require(
      hasRole(PERMISSIONS_ADMIN_ROLE, _msgSender()),
      "must have permissions admin role"
    );
    _;
  }

  /**
   * @dev Grants PERMISSIONS_ADMIN_ROLE to `_permissionsAdmin`.
   *
   * Requirements:
   *
   * - the caller must have ``role``'s admin role.
   * - `_permissionsAdmin` should not be the zero address.
   */
  function setPermissionsAdmin(address _permissionsAdmin) external onlyAdmin {
    require(
      _permissionsAdmin != address(0),
      "_permissionsAdmin is the zero address"
    );
    grantRole(PERMISSIONS_ADMIN_ROLE, _permissionsAdmin);
  }

  /**
   * @dev Sets `_permissionItems` as the new permissionItems module.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - `_permissionItems` should not be the zero address.
   *
   * @param _permissionItems The address of the new Pemissions module.
   */
  function setPermissionItems(address _permissionItems)
    external
    onlyAdmin
    returns (bool)
  {
    require(
      _permissionItems != address(0),
      "_permissionItems is the zero address"
    );
    emit PermissionItemsSet(_permissionItems);
    permissionItems = _permissionItems;
    return true;
  }

  function createTier(uint256 _tierId, string memory _tierName)
    external
    onlyPermissionsAdmin
  {
    tiers[_tierId] = _tierName;
  }

  /**
   * @dev assigns Tier permission to the list `_accounts`.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - each address in `_accounts` should not have the Tier already assigned.
   *
   * @param _accounts The addresses to assign Tier.
   * @param _tierId The ID of the Tier to assign
   */
  function assingTier(address[] memory _accounts, uint256 _tierId)
    external
    onlyPermissionsAdmin
  {
    for (uint256 i = 0; i < _accounts.length; i++) {
      require(
        !_hasItem(_accounts[i], _tierId),
        "PermissionManager: Address already has Tier 1 assigned"
      );
      PermissionItems(permissionItems).mint(
        _accounts[i],
        _tierId,
        1,
        bytes(tiers[_tierId])
      );
    }
  }

  /**
   * @dev suspends pemissions effects to a list of users.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - All user addresses in `_users` should not be already suspended.
   *
   * @param _users The addresses of the users .
   */
  function suspendUser(address[] memory _users) external onlyPermissionsAdmin {
    for (uint256 i = 0; i < _users.length; i++) {
      require(
        !isSuspended(_users[i]),
        "PermissionManager: Address is already suspended"
      );
      PermissionItems(permissionItems).mint(_users[i], SUSPENDED_ID, 1, "");
    }
  }

  /**
   * @dev Assigns Reject permission to a list of users.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - All user addresses in `_users` should not be already rejected.
   *
   *
   * @param _users The addresses of the users.
   */
  function rejectUser(address[] memory _users) external onlyPermissionsAdmin {
    for (uint256 i = 0; i < _users.length; i++) {
      require(
        !isRejected(_users[i]),
        "PermissionManager: Address is already rejected"
      );
      PermissionItems(permissionItems).mint(_users[i], REJECTED_ID, 1, "");
    }
  }

  /**
   * @dev removes Tier permission from the list `_accounts`.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - each address in `_accounts` should have the Tier assigned.
   *
   * @param _accounts The addresses to revoke Tier.
   */
  function revokeTier(address[] memory _accounts, uint256 _tierId)
    external
    onlyPermissionsAdmin
  {
    for (uint256 i = 0; i < _accounts.length; i++) {
      require(
        _hasItem(_accounts[i], _tierId),
        "PermissionManager: Address doesn't has Tier 1 assigned"
      );
      PermissionItems(permissionItems).burn(_accounts[i], _tierId, 1);
    }
  }

  /**
   * @dev re-activates pemissions effects on a list of users and proxies.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - All user addresses in `_users` should be suspended.
   *
   * @param _users The addresses of the users.
   */
  function unsuspendUser(address[] memory _users)
    external
    onlyPermissionsAdmin
  {
    for (uint256 i = 0; i < _users.length; i++) {
      require(
        isSuspended(_users[i]),
        "PermissionManager: Address is not currently suspended"
      );
      PermissionItems(permissionItems).burn(_users[i], SUSPENDED_ID, 1);
    }
  }

  /**
   * @dev Removes Reject permission from a list of users and proxies.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - All user addresses in `_users` should be rejected.
   *
   *
   * @param _users The addresses of the users and .
   */
  function unrejectUser(address[] memory _users) external onlyPermissionsAdmin {
    for (uint256 i = 0; i < _users.length; i++) {
      require(
        isRejected(_users[i]),
        "PermissionManager: Address is not currently rejected"
      );
      PermissionItems(permissionItems).burn(_users[i], REJECTED_ID, 1);
    }
  }

  /**
   * @dev assigns specific item `_itemId` to the list `_accounts`.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - each address in `_accounts` should not have `_itemId` already assigned.
   *
   * @param _itemId Item to be assigned.
   * @param _accounts The addresses to assign Tier1.
   */
  function assignItem(uint256 _itemId, address[] memory _accounts)
    external
    onlyPermissionsAdmin
  {
    for (uint256 i = 0; i < _accounts.length; i++) {
      require(
        !_hasItem(_accounts[i], _itemId),
        "PermissionManager: Account is assigned with item"
      );
      PermissionItems(permissionItems).mint(_accounts[i], _itemId, 1, "");
    }
  }

  /**
   * @dev removes specific item `_itemId` to the list `_accounts`.
   *
   * Requirements:
   *
   * - the caller must be the owner.
   * - each address in `_accounts` should have `_itemId` already assigned.
   *
   * @param _itemId Item to be removeded
   * @param _accounts The addresses to assign Tier1.
   */
  function removeItem(uint256 _itemId, address[] memory _accounts)
    external
    onlyPermissionsAdmin
  {
    for (uint256 i = 0; i < _accounts.length; i++) {
      require(
        _hasItem(_accounts[i], _itemId),
        "PermissionManager: Account is not assigned with item"
      );
      PermissionItems(permissionItems).burn(_accounts[i], _itemId, 1);
    }
  }

  function userHasItem(address _user, uint256 itemId)
    external
    view
    returns (bool)
  {
    return _hasItem(_user, itemId);
  }

  function _hasItem(address _user, uint256 itemId)
    internal
    view
    returns (bool)
  {
    return PermissionItems(permissionItems).balanceOf(_user, itemId) > 0;
  }

  /**
   * @dev Returns `true` if `_account` has been Suspended.
   *
   * @param _account The address of the user.
   */
  function isSuspended(address _account) public view returns (bool) {
    return _hasItem(_account, SUSPENDED_ID);
  }

  /**
   * @dev Returns `true` if `_account` has been Rejected.
   *
   * @param _account The address of the user.
   */
  function isRejected(address _account) public view returns (bool) {
    return _hasItem(_account, REJECTED_ID);
  }
}
