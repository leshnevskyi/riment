<script lang="ts">
	import { average, ceiling, formatPercentage, getExpertScores } from "$lib";
	import { range, round, sum } from "remeda";
	import { riskGroups as staticRiskGroups } from "./data";
	import { enumi } from "@unielit/enumi";

	const ProbabilityCategory = enumi(
		"very-low",
		"low",
		"medium",
		"high",
		"very-high",
	);

	function getProbailityCategory(value: number) {
		if (value < 0.1) {
			return ProbabilityCategory.VeryLow;
		} else if (value < 0.25) {
			return ProbabilityCategory.Low;
		} else if (value < 0.5) {
			return ProbabilityCategory.Medium;
		} else if (value < 0.75) {
			return ProbabilityCategory.High;
		} else {
			return ProbabilityCategory.VeryHigh;
		}
	}

	const labelByCategory = {
		[ProbabilityCategory.VeryLow]: "Дуже низька",
		[ProbabilityCategory.Low]: "Низька",
		[ProbabilityCategory.Medium]: "Середня",
		[ProbabilityCategory.High]: "Висока",
		[ProbabilityCategory.VeryHigh]: "Дуже висока",
	};

	const riskGroups = $state(
		staticRiskGroups.map((group) => {
			return {
				...group,
				cases: group.cases.map((caseName) => {
					return {
						name: caseName,
						isSelected: true,
					};
				}),
			};
		}),
	);

	const totalRiskCaseCount = $derived(
		riskGroups.reduce((count, group) => {
			return count + group.cases.length;
		}, 0),
	);

	const totalSelectedCaseCount = $derived(
		riskGroups.reduce((count, group) => {
			return count + group.cases.filter(({ isSelected }) => isSelected).length;
		}, 0),
	);

	const selectedCaseCounts = $derived(
		riskGroups.map((group) => {
			return group.cases.filter(({ isSelected }) => isSelected).length;
		}),
	);

	const expertCount = 10;

	let expertProbScoreMatrix = $derived(
		Array.from({ length: riskGroups.length }, () => {
			return getExpertScores(expertCount);
		}),
	);

	function getSkewedRandomNumber(minNumber: number) {
		return (
			minNumber +
			Math.random() * 0.1 +
			Math.random() * (0.1 + Math.random() * 0.7)
		);
	}

	const minValueArrays = [
		[0.1, 0.05, 0.12, 0.08],
		[0.11, 0.07, 0.09, 0.14],
	];

	let expertProbCoeffMatrices = $derived(
		riskGroups.map((group, groupIndex) => {
			return group.cases
				.filter(({ isSelected }) => isSelected)
				.map(() => {
					return range(0, expertCount).map(() => {
						return round(
							getSkewedRandomNumber(minValueArrays[0][groupIndex]),
							2,
						);
					});
				});
		}),
	);

	const weightedExpertProbScoreMatrices = $derived(
		riskGroups.map((group, groupIndex) => {
			return group.cases
				.filter(({ isSelected }) => isSelected)
				.map((_, riskIndex) => {
					return expertProbCoeffMatrices[groupIndex][riskIndex].map(
						(expertCoeff, expertIndex) => {
							return round(
								expertCoeff * expertProbScoreMatrix[groupIndex][expertIndex],
								2,
							);
						},
					);
				});
		}),
	);

	const weightedExpertScoreMatrix = $derived(
		weightedExpertProbScoreMatrices
			.map((matrix) => {
				return matrix.reduce((sumRow, row) => {
					return row.map((score, index) => {
						return sumRow[index] + score;
					});
				});
			})
			.map((groupTotalScores, groupIndex) => {
				return groupTotalScores.map((totalScore, expertIndex) => {
					const caseCount = riskGroups[groupIndex].cases.filter(
						({ isSelected }) => isSelected,
					).length;

					return round(
						totalScore /
							caseCount /
							expertProbScoreMatrix[groupIndex][expertIndex],
						2,
					);
				});
			}),
	);

	const totalGroupProbScores = $derived(
		expertProbScoreMatrix.map((groupScores) => {
			return sum(groupScores);
		}),
	);

	const groupedCaseProbabilities = $derived(
		weightedExpertProbScoreMatrices.map((matrix, groupIndex) => {
			return matrix.map((scores) => {
				return round(sum(scores) / totalGroupProbScores[groupIndex], 3);
			});
		}),
	);

	const groupedCaseProbabilityCategories = $derived(
		groupedCaseProbabilities.map((probabilities) => {
			return probabilities.map((value) => {
				return getProbailityCategory(value);
			});
		}),
	);

	const averageGroupProbabilities = $derived(
		groupedCaseProbabilities.map((probabilities) => {
			return round(average(probabilities), 3);
		}),
	);

	const groupProbabilityCategories = $derived(
		averageGroupProbabilities.map((value) => {
			return getProbailityCategory(value);
		}),
	);

	const averageProbability = $derived(
		round(average(averageGroupProbabilities), 3),
	);

	let groupCosts = $derived.by(() => {
		const intermediateNumbers = selectedCaseCounts.map((count, index) => {
			return count + (Math.random() * (selectedCaseCounts[index + 1] || 0)) / 3;
		});

		const totalIntermediateNumber = sum(intermediateNumbers);

		const coeffs = intermediateNumbers.map((number) => {
			return number / totalIntermediateNumber;
		});

		const totalCostSeed = 300 + Math.random() * 1000;
		const totalCost = round(
			ceiling(totalCostSeed + (Math.random() * totalCostSeed) / 2, 10),
			0,
		);
		const weightedGroupCosts = coeffs.map((coeff) => {
			return round(ceiling(totalCost * coeff, 10), 0);
		});

		return weightedGroupCosts;
	});

	const totalInitialCost = $derived(sum(groupCosts));

	let expertCostScoreMatrix = $derived(
		Array.from({ length: riskGroups.length }, () => {
			return getExpertScores(expertCount);
		}),
	);

	const totalGroupCostScores = $derived(
		expertCostScoreMatrix.map((groupScores) => {
			return sum(groupScores);
		}),
	);

	const groupedRandomCostCoeffs = $derived(
		riskGroups.map((group, groupIndex) => {
			return group.cases
				.filter(({ isSelected }) => isSelected)
				.map(() => {
					return (
						minValueArrays[1][groupIndex] +
						Math.random() * minValueArrays[1][groupIndex]
					);
				});
		}),
	);

	const randomExpertCostCoeffs = $derived(
		Array.from({ length: expertCount }, () => {
			return 0.2 + Math.random() * 0.5;
		}),
	);

	const groupedCaseCosts = $derived(
		riskGroups.map((group, groupIndex) => {
			return group.cases
				.filter(({ isSelected }) => isSelected)
				.map((_, riskIndex) => {
					const totalRandomCoeff = sum(groupedRandomCostCoeffs[groupIndex]);

					return round(
						(groupCosts[groupIndex] *
							groupedRandomCostCoeffs[groupIndex][riskIndex]) /
							totalRandomCoeff,
						2,
					);
				});
		}),
	);

	let expertCostCoeffMatrices = $derived(
		riskGroups.map((group, groupIndex) => {
			return group.cases
				.filter(({ isSelected }) => isSelected)
				.map((_, caseIndex) => {
					return range(0, expertCount).map((expertIndex) => {
						return round(
							groupedRandomCostCoeffs[groupIndex][caseIndex] +
								Math.random() * randomExpertCostCoeffs[expertIndex],
							2,
						);
					});
				});
		}),
	);

	const groupedAverageCaseCosts = $derived(
		groupedCaseCosts.map((caseCosts, groupIndex) => {
			return caseCosts.map((caseCost, caseIndex) => {
				return round(
					average(expertCostCoeffMatrices[groupIndex][caseIndex]) * caseCost,
					2,
				);
			});
		}),
	);

	const weightedExpertCostScoreMatrices = $derived(
		expertCostCoeffMatrices.map((matrix, groupIndex) => {
			return matrix.map((caseCoeffs) => {
				return caseCoeffs.map((coeff, expertIndex) => {
					return round(
						coeff * expertCostScoreMatrix[groupIndex][expertIndex],
						2,
					);
				});
			});
		}),
	);

	const groupedAverageWeightedCostScores = $derived(
		weightedExpertCostScoreMatrices.map((matrix, groupIndex) => {
			return matrix
				.reduce((sumRow, row) => {
					return row.map((score, index) => {
						return sumRow[index] + score;
					});
				})
				.map((totalScore, expertIndex) => {
					return round(
						totalScore /
							weightedExpertCostScoreMatrices[groupIndex].length /
							expertCostScoreMatrix[groupIndex][expertIndex],
						2,
					);
				});
		}),
	);

	const groupedAdditionalCosts = $derived(
		weightedExpertCostScoreMatrices.map((matrix, groupIndex) => {
			return matrix.map((scores, riskIndex) => {
				return round(
					(sum(scores) / totalGroupCostScores[groupIndex]) *
						groupedCaseCosts[groupIndex][riskIndex],
					2,
				);
			});
		}),
	);

	const totalGroupAdditionalCosts = $derived(
		groupedAdditionalCosts.map((additionalCosts) => {
			return round(sum(additionalCosts), 2);
		}),
	);

	const minGroupAdditionalCosts = $derived(
		groupedAdditionalCosts.map((additionalCosts) => {
			return Math.min(...additionalCosts);
		}),
	);

	const minAdditionalCost = $derived(Math.min(...minGroupAdditionalCosts));

	const maxGroupAdditionalCosts = $derived(
		groupedAdditionalCosts.map((additionalCosts) => {
			return Math.max(...additionalCosts);
		}),
	);

	const maxAdditionalCost = $derived(Math.max(...maxGroupAdditionalCosts));

	const groupedFinalCosts = $derived(
		groupedAdditionalCosts.map((additionalCosts, groupIndex) => {
			return additionalCosts.map((additionalCost, riskIndex) => {
				return round(
					groupedCaseCosts[groupIndex][riskIndex] + additionalCost,
					2,
				);
			});
		}),
	);

	const totalFinalGroupCosts = $derived(
		groupCosts.map((cost, groupIndex) => {
			return round(cost + totalGroupAdditionalCosts[groupIndex], 2);
		}),
	);

	const totalFinalCost = $derived(round(sum(totalFinalGroupCosts), 2));

	const interval = $derived(
		round((maxAdditionalCost - minAdditionalCost) / 3, 2),
	);

	const PriorityCategory = enumi("low", "medium", "high");

	function getPriorityCategory(additionalCost: number) {
		const outOfBoundsError = new Error("Cost is out of bounds");

		if (additionalCost < minAdditionalCost) {
			throw outOfBoundsError;
		} else if (additionalCost < minAdditionalCost + interval) {
			return PriorityCategory.Low;
		} else if (additionalCost < minAdditionalCost + interval * 2) {
			return PriorityCategory.Medium;
		} else if (additionalCost <= maxAdditionalCost) {
			return PriorityCategory.High;
		} else {
			throw outOfBoundsError;
		}
	}

	const priorityLabelByCategory = {
		[PriorityCategory.Low]: "Низький",
		[PriorityCategory.Medium]: "Середній",
		[PriorityCategory.High]: "Високий",
	};
</script>

<div class="flex flex-col items-start gap-2 overflow-scroll">
	<table class="m-5">
		<tbody>
			{#each riskGroups as group, index (group.name)}
				{@const selectedCaseCount = selectedCaseCounts[index]}
				{@const selectedCaseFraction = selectedCaseCount / totalRiskCaseCount}
				<tr>
					<th>{group.name}</th>
					<td>{selectedCaseCount}</td>
					<td>{formatPercentage(selectedCaseFraction)}</td>
				</tr>
				{#each group.cases as riskCase (riskCase.name)}
					<tr>
						<td>{riskCase.name}</td>
						<td>
							<input type="checkbox" bind:checked={riskCase.isSelected} />
						</td>
					</tr>
				{/each}
			{/each}
			<tr>
				<th></th>
				<td>{totalSelectedCaseCount}</td>
				<td>{formatPercentage(totalSelectedCaseCount / totalRiskCaseCount)}</td>
			</tr>
		</tbody>
	</table>
	<table class="m-5">
		<tbody>
			{#each riskGroups as group, groupIndex (group.name)}
				<tr>
					<th>{group.name}</th>
					{#each expertProbScoreMatrix[groupIndex], scoreIndex (scoreIndex)}
						<td>
							<input
								min={1}
								max={10}
								class="w-14"
								type="number"
								value={expertProbScoreMatrix[groupIndex][scoreIndex]}
								oninput={(event) => {
									const clonedMatrix = [...expertProbScoreMatrix];
									clonedMatrix[groupIndex][scoreIndex] =
										event.currentTarget.valueAsNumber;
									expertProbScoreMatrix = clonedMatrix;
								}}
							/>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<table class="m-5">
		<thead>
			<tr>
				<th></th>
				{#each range(0, expertCount) as expertIndex (expertIndex)}
					<th>
						{expertIndex + 1}
					</th>
				{/each}
				<th>&sum;</th>
				{#each range(0, expertCount) as expertIndex (expertIndex)}
					<th>
						{expertIndex + 1}
					</th>
				{/each}
				<th></th>
				<th>Ймовірність виникнення ризикової події</th>
			</tr>
		</thead>
		<tbody>
			{#each riskGroups as group, groupIndex (group.name)}
				<tr>
					<th>{group.name}</th>
					{#each expertProbScoreMatrix[groupIndex] as score, scoreIndex (scoreIndex)}
						<th>{score}</th>
					{/each}
					<th>{totalGroupProbScores[groupIndex]}</th>
					{#each weightedExpertScoreMatrix[groupIndex] as score, scoreIndex (scoreIndex)}
						<th>{score}</th>
					{/each}
					<th>{averageGroupProbabilities[groupIndex]}</th>
					<th>
						{labelByCategory[groupProbabilityCategories[groupIndex]]}
					</th>
				</tr>
				{#each group.cases.filter(({ isSelected }) => isSelected) as riskCase, riskIndex (riskCase.name)}
					<tr>
						<td class="min-w-100">{riskCase.name}</td>
						{#each range(0, expertCount) as expertIndex (expertIndex)}
							<td class="px-0.5">
								<input
									min={0}
									max={1}
									inputmode="decimal"
									step={0.01}
									class="w-12"
									type="number"
									value={expertProbCoeffMatrices[groupIndex][riskIndex][
										expertIndex
									]}
									oninput={(event) => {
										const clonedMatrices = [...expertProbCoeffMatrices];
										clonedMatrices[groupIndex][riskIndex][expertIndex] =
											event.currentTarget.valueAsNumber;
										expertProbCoeffMatrices = clonedMatrices;
									}}
								/>
							</td>
						{/each}
						<td>
							{round(
								average(expertProbCoeffMatrices[groupIndex][riskIndex]),
								2,
							)}
						</td>
						{#each weightedExpertProbScoreMatrices[groupIndex][riskIndex] as score, scoreIndex (scoreIndex)}
							<td>
								{score}
							</td>
						{/each}
						<td>{groupedCaseProbabilities[groupIndex][riskIndex]}</td>
						<td>
							{labelByCategory[
								groupedCaseProbabilityCategories[groupIndex][riskIndex]
							]}
						</td>
					</tr>
				{/each}
			{/each}
			<tr>
				<td colspan={2 + expertCount * 2}></td>
				<th>{averageProbability}</th>
				<th>{labelByCategory[getProbailityCategory(averageProbability)]}</th>
			</tr>
		</tbody>
	</table>
	<table class="m-5">
		<tbody>
			{#each riskGroups as group, groupIndex (group.name)}
				<tr>
					<th>{group.name}</th>
					{#each expertCostScoreMatrix[groupIndex], scoreIndex (scoreIndex)}
						<td>
							<input
								min={1}
								max={10}
								class="w-14"
								type="number"
								value={expertCostScoreMatrix[groupIndex][scoreIndex]}
								oninput={(event) => {
									const clonedMatrix = [...expertCostScoreMatrix];
									clonedMatrix[groupIndex][scoreIndex] =
										event.currentTarget.valueAsNumber;
									expertCostScoreMatrix = clonedMatrix;
								}}
							/>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<table class="m-5">
		<caption>Розподіл вартості реалізації проекту за множинами ризиків</caption>
		<thead>
			<tr>
				<th></th>
				<th>&sum;</th>
				{#each range(0, riskGroups.length) as groupIndex (groupIndex)}
					<th>
						{groupIndex + 1}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			<tr>
				<th>Початкова вартість реалізації проекту (тис. грн)</th>
				<td>{totalInitialCost}</td>
				{#each groupCosts as cost, index (index)}
					<td>
						<input
							type="number"
							min={10}
							max={10000}
							class="w-12"
							value={cost}
							oninput={(event) => {
								const clonedCosts = [...groupCosts];
								clonedCosts[index] = event.currentTarget.valueAsNumber;
								groupCosts = clonedCosts;
							}}
						/>
					</td>
				{/each}
			</tr>
			<tr>
				<th>Кінцева вартість реалізації проекту (тис. грн)</th>
				<td>{totalFinalCost}</td>
				{#each totalFinalGroupCosts as cost, index (index)}
					<td>
						{cost}
					</td>
				{/each}
			</tr>
		</tbody>
	</table>
	<table class="m-5">
		<thead>
			<tr>
				<th></th>
				<th></th>
				{#each range(0, expertCount) as expertIndex (expertIndex)}
					<th>
						{expertIndex + 1}
					</th>
				{/each}
				<th>&sum;</th>
				{#each range(0, expertCount) as expertIndex (expertIndex)}
					<th>
						{expertIndex + 1}
					</th>
				{/each}
				<th>Додаткова вартість, тис. грн.</th>
				<th>Кінцева вартість, тис. грн.</th>
				<th>Рівень пріоритету ризику</th>
			</tr>
		</thead>
		<tbody>
			{#each riskGroups as group, groupIndex (group.name)}
				<tr>
					<th>{group.name}</th>
					<th>{groupCosts[groupIndex]}</th>
					{#each expertCostScoreMatrix[groupIndex] as score, scoreIndex (scoreIndex)}
						<th>{score}</th>
					{/each}
					<th>{totalGroupCostScores[groupIndex]}</th>
					{#each groupedAverageWeightedCostScores[groupIndex] as score, scoreIndex (scoreIndex)}
						<th>{score}</th>
					{/each}
					<th>
						{totalGroupAdditionalCosts[groupIndex]}
					</th>
					<th>
						{totalFinalGroupCosts[groupIndex]}
					</th>
				</tr>
				{#each group.cases.filter(({ isSelected }) => isSelected) as riskCase, riskIndex (riskCase.name)}
					<tr>
						<td class="min-w-100">{riskCase.name}</td>
						<td>{groupedCaseCosts[groupIndex][riskIndex]}</td>
						{#each range(0, expertCount) as expertIndex (expertIndex)}
							<td class="px-0.5">
								<input
									min={0}
									max={1}
									inputmode="decimal"
									step={0.01}
									class="w-12"
									type="number"
									value={expertCostCoeffMatrices[groupIndex][riskIndex][
										expertIndex
									]}
									oninput={(event) => {
										const clonedMatrices = [...expertCostCoeffMatrices];
										clonedMatrices[groupIndex][riskIndex][expertIndex] =
											event.currentTarget.valueAsNumber;
										expertCostCoeffMatrices = clonedMatrices;
									}}
								/>
							</td>
						{/each}
						<td>{groupedAverageCaseCosts[groupIndex][riskIndex]}</td>
						{#each weightedExpertCostScoreMatrices[groupIndex][riskIndex] as score, scoreIndex (scoreIndex)}
							<td>
								{score}
							</td>
						{/each}
						<td
							class:bg-blue-100={groupedAdditionalCosts[groupIndex][
								riskIndex
							] == minGroupAdditionalCosts[groupIndex]}
							class:bg-red-100={groupedAdditionalCosts[groupIndex][riskIndex] ==
								maxGroupAdditionalCosts[groupIndex]}
							class:bg-blue-300={groupedAdditionalCosts[groupIndex][
								riskIndex
							] == minAdditionalCost}
							class:bg-red-300={groupedAdditionalCosts[groupIndex][riskIndex] ==
								maxAdditionalCost}
						>
							{groupedAdditionalCosts[groupIndex][riskIndex]}
						</td>
						<td>
							{groupedFinalCosts[groupIndex][riskIndex]}
						</td>
						<td>
							{priorityLabelByCategory[
								getPriorityCategory(
									groupedAdditionalCosts[groupIndex][riskIndex],
								)
							]}
						</td>
					</tr>
				{/each}
			{/each}
		</tbody>
	</table>
</div>
