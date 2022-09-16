//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./permissioning/interfaces/IPermissionManager.sol";

contract Rocket is Initializable, AccessControlUpgradeable {
  using SafeMathUpgradeable for uint256;
  using CountersUpgradeable for CountersUpgradeable.Counter;
  CountersUpgradeable.Counter private _contributionInt;
  // Declare Simple Global variable then complex global variables
  bytes32 public constant Rocket_Admin_ROLE = keccak256("Rocket_Admin_ROLE");
  address permissionAddress;
  address private feeAddress;
  uint256 internal feeAmount = 12;
  uint256 internal constant DECIMAL = 18;
  mapping(bytes32 => Pool) public pools;
  mapping(uint256 => Contribution) public contributions;
  mapping(bytes32 => ClaimCalendar) public claimCalendars;
  mapping(address => Contribution[]) public myContributions;

  struct Pool {
    uint256 tokenClaimAmount;
    uint256 totalClaimToken;
    uint256 targetAmount;
    uint256 expiryTime;
    uint256 amountContributed;
    address poolRewardAddress;
    uint256 minContributionAmount;
    uint256 maxContributionAmount;
    uint256 contributionFee;
    uint256 contributionOpenDate;
    uint256 contributionCloseDate;
    uint256 price;
    uint256[] tiers;
    bool isComplete;
    bool canClaimToken;
    address[] tokens;
    address receiver;
    bytes32 poolAddress;
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

  struct CreatePoolDTO {
    uint256 _targetAmount;
    address[] _tokens;
    uint256 expiry;
    address _receiver;
    uint256 _price;
    address _poolRewardAddress;
    uint256 _tokenClaimAmount;
    uint256 _claimDuration;
    uint256 _firstInterval;
    uint256 _nextInterval;
    uint256 _finalInterval;
    uint256 _claimRate;
    uint256[] _tiers;
  }

  event CreatedPool(bytes32 poolId, uint256 poolTargetAmount, address receiver);
  event contributed(
    bytes32 poolId,
    address contributor,
    uint256 amount,
    uint256 contributionId
  );

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
    address _rocketAdmin
  ) public {
    permissionAddress = _permissionAddress;

    __AccessControl_init();

    _setupRole(DEFAULT_ADMIN_ROLE, _contractAdmin);

    setRocketAdmin(_rocketAdmin);
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
    // @TODO a create pool token ERC1155 pool token
    // this token should have the pool name and a USDC pair also it should be an NFT
    // so that pool contributors can mint NFT to themselves.

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
      canClaimToken: false,
      tiers: params._tiers,
      minContributionAmount: 0,
      maxContributionAmount: 0,
      contributionFee: 0,
      contributionOpenDate: 0,
      contributionCloseDate: 0
    });

    pools[uinqueAddress] = _pool;
    //
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
    uint256 amount,
    address _token
  ) public returns (uint256) {
    require(canContribute(pools[poolId].tiers), "NOT PERMITTED TO CONTRIBUTE");
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
    uint256 fee = amount.mul(10**DECIMAL).mul(feeAmount.mul(10**DECIMAL - 1));
    safeTransfer(_token, feeAddress, fee);
    safeTransfer(_token, address(this), (amount - fee));
    emit contributed(poolId, msg.sender, amount, current_id);
    return current_id;
  }

  /**
   * @dev updatePoolTier
   * @param poolId bytes32
   * @param tierId uint256
   * @return status bool
   */

  function updateContributionTier(
    bytes32 poolId,
    uint256 tierId,
    uint256 _minContributionAmount,
    uint256 _maxContributionAmount,
    uint256 _contributionFee,
    uint256 _contributionOpenDate,
    uint256 _contributionCloseDate
  ) public returns (bool status) {
    require(
      hasRole(Rocket_Admin_ROLE, _msgSender()),
      "must have Rocket Admin role"
    );
    pools[poolId].tiers.push(tierId);
    pools[poolId].minContributionAmount = _minContributionAmount;
    pools[poolId].maxContributionAmount = _maxContributionAmount;
    pools[poolId].contributionFee = _contributionFee;
    pools[poolId].contributionOpenDate = _contributionOpenDate;
    pools[poolId].contributionCloseDate = _contributionCloseDate;
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

  function canContribute(uint256[] memory tiers) private returns (bool) {
    for (uint256 i = 0; i < tiers.length; i++) {
      if (
        IPermissionManager(permissionAddress).userHasItem(msg.sender, tiers[i])
      ) {
        return true;
      }
    }
    return false;
  }
}
