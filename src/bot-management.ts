export function isSuspiciousBot(request: Request): boolean {
	const botManagement = request.cf?.botManagement as
		| {
				score?: number;
				verifiedBot?: boolean;
		  }
		| undefined;

	const botScore = botManagement?.score;
	const isVerifiedBot = botManagement?.verifiedBot;

	console.log(`Bot score: ${botScore}, Verified bot: ${isVerifiedBot}`);

	return botScore !== undefined && botScore < 30 && !isVerifiedBot;
}
