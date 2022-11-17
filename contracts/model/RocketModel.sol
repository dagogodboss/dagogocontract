//SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.0;
contract RocketModel {

  // Declare Simple Global variable then complex global variables
  bytes32 public constant Rocket_Admin_ROLE = keccak256("Rocket_Admin_ROLE");
  address permissionAddress;
  address internal feeAddress;
  uint256 internal constant DECIMAL = 18;
  uint256 internal constant FEECONS = 10000;
  mapping(bytes32 => Pool) public pools;
  mapping(uint256 => Contribution) public contributions;
  mapping(address => Contribution[]) public myContributions;
  mapping(bytes32 => ContributionSchedule) public contributionSchedules;
  mapping(bytes32 => DistributionSchedule) public distributionSchedules;

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
    uint256 price;
    uint256 expiryTime;
    uint256 targetAmount;
    uint256 totalClaimedToken;
    uint256 amountContributed;
    uint256 poolRewardTokenAmount;
    uint256 currentDistributionBatchId;
    bool isComplete;
    bool canClaimToken;
    address[] tokens;
    address receiver;
    address poolRewardAddress;
    bytes32 poolAddress;
  }

  struct DistributionSchedule{
    bytes32 poolId;
    uint256 startDate;
    uint256 closeDate;
    uint256 batchId;
    uint256 claimPercentage;
  }

  struct Contribution {
    bytes32 poolId;
    address contributor;
    uint256 amountToReceive;
    uint256 amountContributed;
    uint256 lastWithdrawal;
    uint256 nextWithdrawal;
    uint256 totalWithdrwan;
    uint256 distributionBatchId;
  }

  struct CreatePoolDTO {
    uint256 _targetAmount;
    address[] _tokens;
    uint256 expiry;
    address _receiver;
    uint256 _price;
    address _poolRewardAddress;
    uint256 _poolRewardTokenAmount;
  }

  event CreatedPool(bytes32 poolId, uint256 poolTargetAmount, address receiver, address[] tokens);
  event Contributed(
    bytes32 poolId,
    address contributor,
    uint256 amount,
    uint256 contributionId
  );
  event CreatedContributionSchedule(bytes32 poolId, bytes32 scheduleId);
  event PoolTargetCompleted(bytes32 poolId);
  event CreatedDistributionSchedule(bytes32 distributionId,bytes32 poolId, uint256 poolBatchId, uint256 startDate, uint256 closeDate);
}