//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./permissioning/interfaces/IPermissionManager.sol";
import "./model/RocketModel.sol";

contract Rocket is Initializable, RocketModel, AccessControlUpgradeable {
  using SafeMathUpgradeable for uint256;
  using CountersUpgradeable for CountersUpgradeable.Counter;
  CountersUpgradeable.Counter private _contributionInt;
  /**
   * @dev Initalize the contract.
   *
   * Sets ownership to the account that deploys the contract.
   *
   * Requirements:
   *
   * - `_permissionAddress` should not be the zero address.
   *
   * @param _permissionAddress The address of the new Pemissions module.
   * @param _contractAdmin The address of the Smart contract default admin.
   * @param _rocketAdmin The address of the rocket admin.
   */
  function initialize(
    address _permissionAddress,
    address _contractAdmin,
    address _rocketAdmin,
    address _feeAddress
  ) public {
    permissionAddress = _permissionAddress;

    __AccessControl_init();

    _setupRole(DEFAULT_ADMIN_ROLE, _contractAdmin);

    setRocketAdmin(_rocketAdmin);
    feeAddress = _feeAddress;
  }

  /**
   * @dev Grants Rocket_Admin_ROLE to `_RocketAdmin`.
   *
   * Requirements:
   *
   * - the caller must have ``role``'s admin role.
   */
  function setRocketAdmin(address _rocketAdmin) public {
    grantRole(Rocket_Admin_ROLE, _rocketAdmin);
  }

  /**
   * @dev this create a new pool
   * Requirements:
   * - the caller must have ``Admin``'s Role.
   * @param params PoolParams
   * @return pool boolean
   */
  function createPool(CreatePoolDTO memory params)
    public
    returns (bytes32 pool)
  {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "Rocket_Admin_ROLE required"
    );

    bytes32 uinqueAddress = keccak256(abi.encodePacked(block.timestamp));

    Pool memory _pool = Pool({
      targetAmount: params._targetAmount,
      receiver: params._receiver,
      price: params._price.mul(10**DECIMAL),
      poolAddress: uinqueAddress,
      poolRewardAddress: params._poolRewardAddress,
      tokenClaimAmount: params._tokenClaimAmount,
      expiryTime: block.timestamp + (params.expiry * 1 days),
      totalClaimToken: 0,
      tokens: params._tokens,
      amountContributed: 0,
      isComplete: false,
      canClaimToken: false
    });

    pools[uinqueAddress] = _pool;
    ClaimCalendar memory schedule = ClaimCalendar({
      firstInterval: params._firstInterval,
      nextInterval: params._nextInterval,
      finalInterval: params._finalInterval,
      duration: params._claimDuration,
      depoistBatch: 0,
      claimRate: params._claimRate
    });
    claimCalendars[uinqueAddress] = schedule;
    emit CreatedPool(uinqueAddress, params._targetAmount, params._receiver);
    return uinqueAddress;
  }

  function contribute(
    bytes32 poolId,
    bytes32 _scheduleId,
    uint256 amount,
    address _token
  ) public returns (uint256) {
    require(canContribute(_scheduleId, poolId), "NOT PERMITTED TO CONTRIBUTE");
    require(amount > 0, "Amount is zero");
    if (pools[poolId].amountContributed == pools[poolId].targetAmount) {
      pools[poolId].isComplete = true;
      require(
        pools[poolId].amountContributed < pools[poolId].targetAmount,
        "Target reached"
      );
    }
    pools[poolId].amountContributed += amount;
    _contributionInt.increment();
    uint256 current_id = _contributionInt.current();
    contributions[current_id] = Contribution(
      poolId,
      msg.sender,
      amount.mul(10**DECIMAL).div(pools[poolId].price),
      amount,
      0,
      0,
      0,
      0
    );
    myContributions[msg.sender].push(contributions[current_id]);
    if (pools[poolId].amountContributed == pools[poolId].targetAmount) {
      pools[poolId].isComplete = true;
    }
    uint256 fee = amount.mul(10**DECIMAL).mul(contributionSchedules[_scheduleId].contributionFee.mul(10**DECIMAL - 1));
    safeTransfer(_token, feeAddress, fee);
    safeTransfer(_token, address(this), (amount - fee));
    emit contributed(poolId, msg.sender, amount, current_id);
    return current_id;
  }

  /**
   * @dev updatePoolTier
   * @param poolId bytes32
   * @param tierId uint256
   * @param _minContributionAmount uint256
   * @param _maxContributionAmount uint256
   * @param _contributionFee uint256
   * @param _contributionOpenDate uint256
   * @param _contributionCloseDate uint256 
   * @return scheduleId bytes32
   */

  function createContributionSchedule(
    bytes32 poolId,
    uint256 tierId,
    uint256 _minContributionAmount,
    uint256 _maxContributionAmount,
    uint256 _contributionFee,
    uint256 _contributionOpenDate,
    uint256 _contributionCloseDate
  ) public returns (bytes32 scheduleId) {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );
    // create contribution schedules for a Pool
    bytes32 uinqueAddress = keccak256(abi.encodePacked(block.timestamp));
    ContributionSchedule memory schedule = ContributionSchedule(poolId, tierId, _minContributionAmount, _maxContributionAmount, _contributionFee, _contributionOpenDate, _contributionCloseDate);
    contributionSchedules[uinqueAddress] = schedule;
    return uinqueAddress;
  }

  /** @dev For the Admin*/
  function withdrawFunds(bytes32 poolId) public {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );

    require(pools[poolId].amountContributed > 0, "Invalid pool");
    require(pools[poolId].isComplete, "Pool is still active");
    require(
      IERC20(pools[poolId].tokens[0]).transfer(
        pools[poolId].receiver,
        pools[poolId].amountContributed
      ),
      "Transfer failed and reverted."
    );
  }

  function deposit(bytes32 poolId) public returns (bool) {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );
    require(pools[poolId].isComplete, "Pool is still active");
    pools[poolId].canClaimToken = true;
    claimCalendars[poolId].depoistBatch += 1;
    safeTransfer(
      pools[poolId].poolRewardAddress,
      address(this),
      pools[poolId].tokenClaimAmount
    );
    return true;
  }

  // @TODO make it easy to get amount contirbutded to a particular pool
  function claimToken(bytes32 poolId, uint256 contributionId)
    public
    returns (bool)
  {
    require(pools[poolId].isComplete, "Pool is still active");
    require(pools[poolId].canClaimToken, "Pool has not receive reward tokens");
    pools[poolId].totalClaimToken += contributions[contributionId]
      .amountToReceive;
    require(
      IERC20(pools[poolId].poolRewardAddress).balanceOf(address(this)) >=
        contributions[contributionId].amountToReceive,
      "Insufficient balance"
    );
    // require();
    uint256 _amount = contributions[contributionId].amountToReceive *
      (claimCalendars[poolId].depoistBatch -
        contributions[contributionId].withdrawalBatch);
    // Update deposit batch as you claim
    // Update the claim rate and get
    require(
      IERC20(pools[poolId].poolRewardAddress).transferFrom(
        address(this),
        msg.sender,
        _amount - ((_amount * claimCalendars[poolId].claimRate) / 10000)
      ),
      "Transfer failed and reverted."
    );
    return true;
  }

  // @Todo users can claim in percentage,
  // but we can allow user claim be lated tokens from previous days and months
  function safeTransfer(
    address token,
    address _receiver,
    uint256 _amount
  ) internal {
    require(_amount != 0, "Amount is 0");
    require(
      IERC20(token).balanceOf(msg.sender) >= _amount,
      "Insufficient balance"
    );
    require(
      IERC20(token).transferFrom(msg.sender, _receiver, _amount),
      "Transfer failed and reverted."
    );
  }

  function canContribute(bytes32 scheduleId, bytes32 poolId) private view returns (bool) {
      if (
        contributionSchedules[scheduleId].poolId == poolId &&
        IPermissionManager(permissionAddress).userHasItem(msg.sender, contributionSchedules[scheduleId].tier)
      ) {
        return true;
      }
    return false;
  }
}
