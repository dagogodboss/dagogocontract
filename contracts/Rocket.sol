//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Permissioning/interfaces/IPermissionManager.sol";


contract Rocket is AccessControl {
  using Counters for Counters.Counter;
  Counters.Counter private _contributionInt;
  bytes32 public constant Rocket_Admin_ROLE = keccak256("Rocket_Admin_ROLE");

  constructor() {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
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

  struct Pool {
    address poolRewardAddress;
    uint256 tokenClaimAmount;
    uint256 totalClaimToken;
    uint256 targetAmount;
    address[] tokens;
    bytes32 poolAddress;
    uint256 expiryTime;
    uint256 amountContributed;
    address receiver;
    uint256 price;
    bool isComplete;
    bool canClaimToken;
    uint256 tier;
  }
  struct ClaimCalendar {
    uint256 firstInterval;
    uint256 nextInterval;
    uint256 finalInterval;
    uint256 depoistBatch;
    uint256 claimRate;
    uint256 duration;
  }
  struct Contribution {
    bytes32 poolId;
    address contributor;
    uint256 amountToReceive;
    uint256 amountContributed;
    uint256 lastWithdrawal;
    uint256 nextWithdrawal;
    uint256 totalWithdrwan;
    uint256 withdrawalBatch;
  }

  mapping(bytes32 => Pool) public pools;
  mapping(uint256 => Contribution) public contributions;
  mapping(bytes32 => ClaimCalendar) public claimCalendars;
  mapping(address => Contribution[]) public myContributions;

  function createPool(
    uint256 _targetAmount,
    address[] memory _tokens,
    uint256 expiry,
    address _receiver,
    uint256 _price,
    address _poolRewardAddress,
    uint256 _tokenClaimAmount,
    uint256 _claimDuration,
    uint256 _firstInterval,
    uint256 _nextInterval,
    uint256 _finalInterval,
    uint256 _claimRate,
  ) public returns (bytes32 pool) {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );
    bytes32 uinqueAddress = keccak256(abi.encodePacked(block.timestamp));
    Pool memory _pool = Pool({
      targetAmount: _targetAmount,
      receiver: _receiver,
      price: _price,
      poolAddress: uinqueAddress,
      poolRewardAddress: _poolRewardAddress,
      tokenClaimAmount: _tokenClaimAmount,
      expiryTime: block.timestamp + (expiry * 1 days),
      totalClaimToken: 0,
      tokens: _tokens,
      amountContributed: 0,
      isComplete: false,
      canClaimToken: false
    });
    pools[uinqueAddress] = _pool;
    ClaimCalendar memory schedule = ClaimCalendar({
      firstInterval: _firstInterval,
      nextInterval: _nextInterval,
      finalInterval: _finalInterval,
      duration: _claimDuration,
      depoistBatch: 0,
      claimRate: _claimRate
    });
    claimCalendars[uinqueAddress] = schedule;
    emit CreatedPool(uinqueAddress, _targetAmount, _receiver);
    return uinqueAddress;
  }

  function contribute(
    bytes32 poolId,
    uint256 amount,
    address _token
  ) public returns (uint256) {
    require(userHasItem(msg.sender, pools[poolId].tier), 'NOT PERMITTED');
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
      amount,
      (amount * 10**18) / pools[poolId].price
    );
    myContributions[msg.sender].push(contributions[current_id]);
    if (pools[poolId].amountContributed == pools[poolId].targetAmount) {
      pools[poolId].isComplete = true;
    }
    safeTransfer(_token, address(this), amount);
    emit contributed(poolId, msg.sender, amount, current_id);
    return current_id;
  }

  /**
  * @dev updatePoolTier 
  * @param poolId bytes32
  * @param tierId uint256
  * @return status bool
  */
  
  function updatePoolTier(bytes32 poolId, uint256 tierId) public returns(bool status){
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );
    pools[poolId].tier = tierId;
    return true;
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
    require();
    uint256 _amount = contributions[contributionId].amountToReceive * (claimCalendars[poolId].depoistBatch - contributions[contributionId].withdrawalBatch)
    require(
      IERC20(pools[poolId].poolRewardAddress).transferFrom(
        address(this),
        msg.sender,
        _amount - _amount.mul(claimCalendars[poolId].claimRate).div(10000)
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

  event CreatedPool(bytes32 poolId, uint256 poolTargetAmount, address receiver);
  event contributed(
    bytes32 poolId,
    address contributor,
    uint256 amount,
    uint256 contributionId
  );
}
