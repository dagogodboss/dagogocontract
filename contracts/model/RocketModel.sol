//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;
contract RocketModel {

  // Declare Simple Global variable then complex global variables
  bytes32 public constant Rocket_Admin_ROLE = keccak256("Rocket_Admin_ROLE");
  address permissionAddress;
  address internal feeAddress;
  uint256 internal feeAmount = 12;
  uint256 internal constant DECIMAL = 18;
  mapping(bytes32 => Pool) public pools;
  mapping(uint256 => Contribution) public contributions;
  mapping(bytes32 => ClaimCalendar) public claimCalendars;
  mapping(address => Contribution[]) public myContributions;
  mapping(bytes32 => ContributionSchedule) internal contributionSchedules;

  struct ContributionSchedule {
    bytes32 poolId;
    uint256 tier;
    uint256 minContributionAmount;
    uint256 maxContributionAmount;
    uint256 contributionFee;
    uint256 contributionOpenDate;
    uint256 contributionCloseDate;
  }
  
  struct Pool {
    uint256 tokenClaimAmount;
    uint256 totalClaimToken;
    uint256 targetAmount;
    uint256 expiryTime;
    uint256 amountContributed;
    address poolRewardAddress;
    uint256 price;
    address[] tokens;
    bool isComplete;
    bool canClaimToken;
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
  }

  event CreatedPool(bytes32 poolId, uint256 poolTargetAmount, address receiver);
  event contributed(
    bytes32 poolId,
    address contributor,
    uint256 amount,
    uint256 contributionId
  );

}