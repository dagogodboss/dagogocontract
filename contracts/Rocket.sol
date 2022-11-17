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
      isComplete: false,
      canClaimToken: false,
      amountContributed: 0,
      totalClaimedToken: 0,
      tokens: params._tokens,
      receiver: params._receiver,
      poolAddress: uinqueAddress,
      targetAmount: params._targetAmount,
      price: params._price.mul(10**DECIMAL),
      poolRewardAddress: params._poolRewardAddress,
      poolRewardTokenAmount: params._poolRewardTokenAmount,
      expiryTime: block.timestamp + (params.expiry * 1 days),
      currentDistributionBatchId:0
    });
    pools[uinqueAddress] = _pool;
    emit CreatedPool(uinqueAddress, params._targetAmount, params._receiver, params._tokens);
    return uinqueAddress;
  }

  /**
    @dev only admin can call this method. this method create a new distribution schedule
    @param _poolId the pool ID
    @return distributionId address.
   */
  function createDistributionSchedule(bytes32 _poolId, uint256 _startDate, uint256 _closeDate, uint256 _claimPercent) onlyRole(Rocket_Admin_ROLE) external returns (bytes32 distributionId){
    bytes32 id = keccak256(abi.encodePacked(block.timestamp));
    DistributionSchedule memory schedule = DistributionSchedule({
      poolId : _poolId,
      startDate : _startDate,
      closeDate: _closeDate,
      claimPercentage: _claimPercent.mul(10000).div(100),
      batchId : pools[_poolId].currentDistributionBatchId + 1
    });
    distributionSchedules[id] = schedule;
    emit CreatedDistributionSchedule(id, _poolId, (pools[_poolId].currentDistributionBatchId + 1), _startDate, _closeDate);
    return id;
  }

  function contribute(
    bytes32 poolId,
    bytes32 _scheduleId,
    uint256 amount,
    address _token
  ) public returns (uint256) {
  
    require(canContribute(_scheduleId, poolId), "NOT PERMITTED TO CONTRIBUTE");

    require(amount > 0, "Amount is zero");

    require(amount >= contributionSchedules[_scheduleId].minContributionAmount && amount <= contributionSchedules[_scheduleId].maxContributionAmount, "Not a valid amount");

    require(block.timestamp >= contributionSchedules[_scheduleId].contributionOpenDate && block.timestamp <= contributionSchedules[_scheduleId].contributionCloseDate, "pool is not active");

    if (pools[poolId].amountContributed == pools[poolId].targetAmount) {
      pools[poolId].isComplete = true;
      emit PoolTargetCompleted(poolId);
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
      emit PoolTargetCompleted(poolId);
    }
    uint256 fee = (amount.mul(contributionSchedules[_scheduleId].contributionFee)).div(FEECONS);
    emit Contributed(poolId, msg.sender, amount, current_id);
    safeTransfer(_token, feeAddress, fee);
    safeTransfer(_token, address(this), (amount - fee));
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
    require(IPermissionManager(permissionAddress).tierExists(tierId), "Tier Not Found");
    // create contribution schedules for a Pool
    bytes32 uinqueAddress = keccak256(abi.encodePacked(block.timestamp));
    ContributionSchedule memory schedule = ContributionSchedule(poolId, tierId, _minContributionAmount, _maxContributionAmount, (_contributionFee.mul(10000).div(100)), _contributionOpenDate, _contributionCloseDate);
    contributionSchedules[uinqueAddress] = schedule;
    emit CreatedContributionSchedule(poolId, uinqueAddress);
    return uinqueAddress;
  }

  /**
  *  @dev For the Admin 
  *  Pulls funds from the pool to the pool benefactor.
  *  @param poolId bytes32
  */
  function withdrawFundToReceiver(bytes32 poolId) external {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );

    require(pools[poolId].amountContributed > 0, "pool is empty");
    require(pools[poolId].isComplete, "Pool is still active");
    
    for(uint256 i = 0; i < pools[poolId].tokens.length; i++){
      uint256 availableAmount = IERC20(pools[poolId].tokens[i]).balanceOf(address(this));
      require(
        IERC20(pools[poolId].tokens[i]).transfer(
          pools[poolId].receiver,
          availableAmount
        ),
        "Transfer failed and reverted."
      );
    }
  }

  /**
    @dev Admin depoists the Pool reward token for contributors to withdraw their reward
    @param poolId bytes32
   */
  function depositPoolRewardTokens(bytes32 poolId) external returns (bool) {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );
    require(pools[poolId].isComplete, "Pool is active");
    pools[poolId].canClaimToken = true;
    safeTransfer(
      pools[poolId].poolRewardAddress,
      address(this),
      pools[poolId].poolRewardTokenAmount
    );
    return true;
  }

  function claimPoolRewardToken(bytes32 poolId, uint256 contributionId, bytes32 distributionId)
    public
    returns (bool)
  {
    require(pools[poolId].isComplete, "Pool is active");
    require(pools[poolId].canClaimToken, "Pool has no reward tokens");
    require(
      IERC20(pools[poolId].poolRewardAddress).balanceOf(address(this)) >=
        contributions[contributionId].amountToReceive,
      "Insufficient balance"
    );

    require(distributionSchedules[distributionId].batchId > contributions[contributionId].distributionBatchId, "double claim found");
 
    require (block.timestamp >= distributionSchedules[distributionId].startDate && block.timestamp <= distributionSchedules[distributionId].closeDate, "distribution not available");
 
    pools[poolId].totalClaimedToken += contributions[contributionId].amountToReceive;
    
    uint256 _amount = contributions[contributionId].amountToReceive *
      (distributionSchedules[distributionId].batchId -
        contributions[contributionId].distributionBatchId);
    contributions[contributionId].distributionBatchId = distributionSchedules[distributionId].batchId;

    require(
      IERC20(pools[poolId].poolRewardAddress).transferFrom(
        address(this),
        msg.sender,
        _amount - ((_amount * distributionSchedules[distributionId].claimPercentage) / FEECONS)
      ),
      "Transfer failed and reverted."
    );
    return true;
  }

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
