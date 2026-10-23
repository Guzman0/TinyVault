// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Subsets of Mezo's MUSD contracts (github.com/mezo-org/musd) that TinyVault calls.
interface IBorrowerOperations {
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint) external payable;
    function addColl(address upperHint, address lowerHint) external payable;
    function withdrawColl(uint256 amount, address upperHint, address lowerHint) external;
    function withdrawMUSD(uint256 amount, address upperHint, address lowerHint) external;
    function repayMUSD(uint256 amount, address upperHint, address lowerHint) external;
    function refinance(address upperHint, address lowerHint) external;
    function claimCollateral() external;

    function minNetDebt() external view returns (uint256);
    function MUSD_GAS_COMPENSATION() external view returns (uint256);
    function getBorrowingFee(uint256 debt) external view returns (uint256);
    function troveManager() external view returns (address);
    function priceFeed() external view returns (address);
    function musd() external view returns (address);
    function sortedTroves() external view returns (address);
}

interface ITroveManager {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    function getEntireDebtAndColl(address borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );

    function getTroveStatus(address borrower) external view returns (Status);
    function getTroveDebt(address borrower) external view returns (uint256);
    function getTroveColl(address borrower) external view returns (uint256);
    function getTroveMaxBorrowingCapacity(address borrower) external view returns (uint256);
}

interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}
