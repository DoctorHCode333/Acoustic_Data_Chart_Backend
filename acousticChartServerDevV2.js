const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
const https = require("https");
const fs = require("fs");
const {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  subDays,
  differenceInDays,
} = require("date-fns");

const app = express();
var hostname = "localhost";
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 8014;
//Set Oracle DB connection settings
const dbConfig = {
  user: "GEN_IXNDB",
  password: "Knu54h#I4dmE6P9a",
  connectString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
};

// Function to fetch data from the database
const fetchData = async (query, binds) => {
  const connection = await oracledb.getConnection(dbConfig);
  try {
    const result = await connection.execute(query, binds);
    return result;
  } finally {
    await connection.close();
  }
};



app.post("/interactionsTrendData", async (req, res) => {
  console.log("INTERACTIONS ROUTE");
  const targetFormatter = "yyyy-MM-dd";
  let fromDate = req.body.startDate;
  let toDate = req.body.endDate;
  let selectedCallDuration = req.body.selectedCallDuration;
  let selectedACDTime = req.body.selectedACDTime;
  let selectedCustomerTime = req.body.selectedCustomerTime;
  let selectedAgentTime = req.body.selectedAgentTime;
  let selectedSilenceTime = req.body.selectedSilenceTime;
  let selectedIVRTime = req.body.selectedIVRTime;
  let selectedOthersTime = req.body.selectedOthersTime;
  let selectedOvertalkCount = req.body.selectedOvertalkCount;
  // Extract filters
  
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];
  let partyId = req.body.partyId || [];

  let connection;

  try {
    // Format and validate input date
    fromDate = format(parseISO(fromDate), targetFormatter);
    toDate = format(parseISO(toDate), targetFormatter);

    const period = differenceInDays(toDate, fromDate) + 1;
    console.log("period", period);

    const previousFromDate = format(
      subDays(parseISO(fromDate), period),
      targetFormatter
    );

    const previousToDate = format(
      subDays(parseISO(fromDate), 1),
      targetFormatter
    );
    console.log("Past Date", previousFromDate, " ", previousToDate);

    connection = await oracledb.getConnection(dbConfig);

    // Fetch total data for current and previous periods
    let fetchTotalInteractionsQuery = `
      SELECT 
        COUNT(CONVERSATION_ID) AS interactions
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
        AND (CALLDURATION >= (:callFrom) OR CALLDURATION is null)
        AND (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)  OR ACDDURATIONPERCENTAGE is null)
        AND (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo) OR CUSTOMERDURATIONPERCENTAGE is null)
        AND (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) OR AGENTDURATIONPERCENTAGE is null)
        AND (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) OR SILENCEDURATIONPERCENTAGE is null)
        AND (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo) OR IVRDURATIONPERCENTAGE is null)
        AND (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) OR OTHERDURATIONPERCENTAGE is null) 
        AND (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) OR OVERTALKCOUNT is null)
        `;

    let fetchDailyTotalInteractionsQuery = `
      SELECT 
          TRUNC(STARTDATE)AS STARTDATE,COUNT(CONVERSATION_ID) AS interactions
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
        AND (CALLDURATION >= (:callFrom) OR CALLDURATION is null)
        AND (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)  OR ACDDURATIONPERCENTAGE is null)
        AND (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo) OR CUSTOMERDURATIONPERCENTAGE is null)
        AND (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) OR AGENTDURATIONPERCENTAGE is null)
        AND (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) OR SILENCEDURATIONPERCENTAGE is null)
        AND (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo) OR IVRDURATIONPERCENTAGE is null)
        AND (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) OR OTHERDURATIONPERCENTAGE is null) 
        AND (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) OR OVERTALKCOUNT is null)
        `;

    let fetchDataQuery = `SELECT COUNT(CONVERSATION_ID)as interactions,
        SUM(CASE WHEN  (CALLDURATION >= (:callFrom)) THEN 1 ELSE 0 END) as callCount,
        SUM(CASE WHEN  (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)) THEN 1 ELSE 0 END) as ACDCount,
        SUM(CASE WHEN  (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo)) THEN 1 ELSE 0 END) as customerCount, 
        SUM(CASE WHEN  (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )THEN 1 ELSE 0 END) as agentCount,
        SUM(CASE WHEN  (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) )THEN 1 ELSE 0 END) as silenceCount,
        SUM(CASE WHEN  (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))THEN 1 ELSE 0 END) as IVRCount,
        SUM(CASE WHEN  (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) ) THEN 1 ELSE 0 END) as othersCount,
        SUM(CASE WHEN  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) ) THEN 1 ELSE 0 END) as overtalkCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchDailyDataQuery = ` SELECT 
        TRUNC(STARTDATE)AS STARTDATE,COUNT(CONVERSATION_ID)as interactions,
        SUM(CASE WHEN  (CALLDURATION >= (:callFrom)) THEN 1 ELSE 0 END) as callCount,
        SUM(CASE WHEN (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)) THEN 1 ELSE 0 END) as ACDCount,
        SUM(CASE WHEN  (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo)) THEN 1 ELSE 0 END) as customerCount, 
        SUM(CASE WHEN  (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )THEN 1 ELSE 0 END) as agentCount,
        SUM(CASE WHEN  (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) )THEN 1 ELSE 0 END) as silenceCount,
        SUM(CASE WHEN  (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))THEN 1 ELSE 0 END) as IVRCount,
        SUM(CASE WHEN  (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) ) THEN 1 ELSE 0 END) as othersCount,
        SUM(CASE WHEN  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) ) THEN 1 ELSE 0 END) as overtalkCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    // Generate placeholders for the filters
    let queueRegex;
    if(queue.length>1){
      queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(queue.length==1){
      queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
    let workTeamRegex;
    if(workTeams.length>1){
      workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(workTeams.length==1){
      workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    let agentIdRegex;
    if(agentId.length>1){
      agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(agentId.length==1){
      agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
    const placeholdersForMarketSector = marketSector
      .map((_, i) => `:marketSector${i + 1}`)
      .join(", ");
    const placeholdersForDivision = division
    .map((_, i) => `:division${i + 1}`)
    .join(", ");
    const placeholdersForClientId = clientId
      .map((_, i) => `:clientId${i + 1}`)
      .join(", ");
    const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");
    // const placeholdersForSilenceFrom = `:silenceFrom`
    // const placeholdersForSilenceTo = `:silenceTo`

    // Append filters to the queries if they are provided
    if (lob.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchDataQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchDailyDataQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
    }

    if (marketSector.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchDataQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchDailyDataQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
    }

    if (division.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchDataQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchDailyDataQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
    }
    if (queue.length > 0) {
      fetchTotalInteractionsQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchDailyTotalInteractionsQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchDataQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchDailyDataQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
    }
    if (clientId.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchDataQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchDailyDataQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
    }
    if (workTeams.length > 0) {
      fetchTotalInteractionsQuery += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchDailyTotalInteractionsQuery += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchDataQuery += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchDailyDataQuery += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
    }
    if (agentId.length > 0) {
      fetchTotalInteractionsQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchDailyTotalInteractionsQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchDataQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchDailyDataQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
    }
    if (ANI.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchDataQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchDailyDataQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
    }

    // Prepare binds for query
    const binds = {
      fromDate,
      toDate,
      callFrom: selectedCallDuration,
      ACDFrom: selectedACDTime.from,
      ACDTo: selectedACDTime.to,
      customerFrom: selectedCustomerTime.from,
      customerTo: selectedCustomerTime.to,
      agentFrom: selectedAgentTime.from,
      agentTo: selectedAgentTime.to,
      silenceFrom: selectedSilenceTime.from,
      silenceTo: selectedSilenceTime.to,
      IVRFrom: selectedIVRTime.from,
      IVRTo: selectedIVRTime.to,
      othersFrom: selectedOthersTime.from,
      othersTo: selectedOthersTime.to,
      overtalkFrom: selectedOvertalkCount.from,
      overtalkTo: selectedOvertalkCount.to,
    };
    lob.forEach((lobVal, index) => {
      binds[`lob${index + 1}`] = lobVal;
    });
    marketSector.forEach((marketVal, index) => {
      binds[`marketSector${index + 1}`] = marketVal;
    });
    division.forEach((divisionVal, index) => {
      binds[`division${index + 1}`] = divisionVal;
    });
    clientId.forEach((clientVal, index) => {
      binds[`clientId${index + 1}`] = clientVal;
    });
    ANI.forEach((ANIVal, index) => {
      binds[`ANI${index + 1}`] = ANIVal;
    });

    // console.log(binds);
    // console.log(fetchTotalsQuery);
    fetchDailyDataQuery += `group by TRUNC(STARTDATE)
    ORDER BY STARTDATE`;
    fetchDailyTotalInteractionsQuery += `group by TRUNC(STARTDATE)
    ORDER BY STARTDATE`;
    // Execute current totals query

    // const currentInteractionsTotal = await connection.execute(fetchTotalInteractionsQuery, binds);
    //const currentDailyInteractionTotals = await connection.execute(fetchDailyTotalInteractionsQuery, binds);

  
    const currentDataTotal = await connection.execute(
      fetchDataQuery,
      binds
    );

    const dailyDataResponse = await connection.execute(
      fetchDailyDataQuery,
      binds
    );

   
    // const totalInteractionsTimePeriod = currentDataTotal.rows.map(
    //   (result) => result[0].toISOString().split("T")[0]
    // );
    const interactionsArray = dailyDataResponse.rows.map(
      (result) => result[1]
    );

    const timePeriod = dailyDataResponse.rows.map(
      (result) => result[0].toISOString().split("T")[0]
    );
  
   
  
    // timeSet.forEach((date)=>totalInteractionsTimePeriod.push(date));
    // console.log(totalInteractionsTimePeriod);
    
    // totalInteractionsTimePeriod.forEach((date) => {
    //   // Set to zero if no data is present for that day
    //   if (!interactionsArray[date]) interactionsArray[date] = 0;
    // });
   
   
   
    const callDurationTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[2]
    );
    const ACDTrendDataArray = dailyDataResponse.rows.map((result) => result[3]);
    const customerTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[4]
    );
    const agentTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[5]
    );
    const silenceTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[6]
    );
    const IVRTrendDataArray = dailyDataResponse.rows.map((result) => result[7]);
    const othersTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[8]
    );
    const overtalkTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[9]
    );

    let dailyData = {
      interactions: interactionsArray,
      callDuration: callDurationTrendDataArray,
      ACDTrendData: ACDTrendDataArray,
      customerTrendData: customerTrendDataArray,
      agentTrendData: agentTrendDataArray,
      silenceTrendData: silenceTrendDataArray,
      IVRTrendData: IVRTrendDataArray,
      othersTrendData: othersTrendDataArray,
      overtalkTrendData: overtalkTrendDataArray,
    };

    // Execute previous totals query
    const previousInteractionsTotal = await connection.execute(fetchTotalInteractionsQuery, {
      ...binds,
      fromDate: previousFromDate,
      toDate: previousToDate,
    });
    const previousDataTotal= await connection.execute(fetchDataQuery, {
      ...binds,
      fromDate: previousFromDate,
      toDate: previousToDate,
    });

    const processTotals = (data1) => ({
      interactions: data1.rows[0][0] || 0, // Set to zero if undefined
      callDurationTrendData: data1.rows[0][1] || 0,
      ACDTrendData: data1.rows[0][2] || 0,
      customerTrendData: data1.rows[0][3] || 0,
      agentTrendData: data1.rows[0][4] || 0,
      silenceTrendData: data1.rows[0][5] || 0,
      IVRTrendData: data1.rows[0][6] || 0,
      othersTrendData: data1.rows[0][7] || 0,
      overtalkTrendData: data1.rows[0][8] || 0,
    });

    const calcPercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.ceil(((current - previous) / previous) * 10000) / 100;
    };

    const current = processTotals(currentDataTotal);
    const previous = processTotals(previousDataTotal);

    // Calculate percentage changes
    const percentChanges = {
      interactions: calcPercentageChange(
        current.interactions,
        previous.interactions
      ),
      callDurationTrendData: calcPercentageChange(
        current.callDurationTrendData,
        previous.callDurationTrendData
      ),
      ACDTrendData: calcPercentageChange(
        current.ACDTrendData,
        previous.ACDTrendData
      ),
      customerTrendData: calcPercentageChange(
        current.customerTrendData,
        previous.customerTrendData
      ),
      agentTrendData: calcPercentageChange(
        current.agentTrendData,
        previous.agentTrendData
      ),
      silenceTrendData: calcPercentageChange(
        current.silenceTrendData,
        previous.silenceTrendData
      ),
      IVRTrendData: calcPercentageChange(
        current.IVRTrendData,
        previous.IVRTrendData
      ),
      othersTrendData: calcPercentageChange(
        current.othersTrendData,
        previous.othersTrendData
      ),
      overtalkTrendData: calcPercentageChange(
        current.overtalkTrendData,
        previous.overtalkTrendData
      ),
    };

    // console.log({
    //   currentPeriod: { ...current },
    //   previousPeriod: { ...previous },
    //   percentChanges,
    //   dailyData: dailyData,
    //   timePeriod: timePeriod,
    //   //totalInteractionsTimePeriod: totalInteractionsTimePeriod,
    //   FeedSuccess: "True",
    // });

    res.json({
      currentPeriod: { ...current },
      previousPeriod: { ...previous },
      percentChanges,
      dailyData: dailyData,
      timePeriod: timePeriod,
      FeedSuccess: "True",
    });
  } catch (error) {
    console.error(error);
    res.json({ FeedFail: "True" });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
app.post("/interactionsTrendDownloadData", async (req, res) => {
  console.log("INTERACTIONS Summary Download ROUTE");
  const targetFormatter = "yyyy-MM-dd";
  let fromDate = req.body.startDate;
  let toDate = req.body.endDate;
  let selectedCallDuration = req.body.selectedCallDuration;
  let selectedACDTime = req.body.selectedACDTime;
  let selectedCustomerTime = req.body.selectedCustomerTime;
  let selectedAgentTime = req.body.selectedAgentTime;
  let selectedSilenceTime = req.body.selectedSilenceTime;
  let selectedIVRTime = req.body.selectedIVRTime;
  let selectedOthersTime = req.body.selectedOthersTime;
  let selectedOvertalkCount = req.body.selectedOvertalkCount;
  // Extract filters
  
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];

  let connection;

  try {
    // Format and validate input date 
    fromDate = format(parseISO(fromDate), targetFormatter);
    toDate = format(parseISO(toDate), targetFormatter);

    const period = differenceInDays(toDate, fromDate) + 1;
    console.log("period", period);

    const previousFromDate = format(
      subDays(parseISO(fromDate), period),
      targetFormatter
    );

    const previousToDate = format(
      subDays(parseISO(fromDate), 1),
      targetFormatter
    );
    console.log("Past Date", previousFromDate, " ", previousToDate);

    connection = await oracledb.getConnection(dbConfig);

    // Fetch total data for current and previous periods
    let fetchTotalInteractionsQuery = `
      SELECT 
        COUNT(CONVERSATION_ID) AS interactions
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
        AND (CALLDURATION >= (:callFrom) OR CALLDURATION is null)
        AND (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)  OR ACDDURATIONPERCENTAGE is null)
        AND (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo) OR CUSTOMERDURATIONPERCENTAGE is null)
        AND (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) OR AGENTDURATIONPERCENTAGE is null)
        AND (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) OR SILENCEDURATIONPERCENTAGE is null)
        AND (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo) OR IVRDURATIONPERCENTAGE is null)
        AND (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) OR OTHERDURATIONPERCENTAGE is null) 
        AND (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) OR OVERTALKCOUNT is null)
        `;

    let fetchDailyTotalInteractionsQuery = `
      SELECT 
          TRUNC(STARTDATE)AS STARTDATE,COUNT(CONVERSATION_ID) AS interactions
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
        AND (CALLDURATION >= (:callFrom) OR CALLDURATION is null)
        AND (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)  OR ACDDURATIONPERCENTAGE is null)
        AND (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo) OR CUSTOMERDURATIONPERCENTAGE is null)
        AND (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) OR AGENTDURATIONPERCENTAGE is null)
        AND (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) OR SILENCEDURATIONPERCENTAGE is null)
        AND (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo) OR IVRDURATIONPERCENTAGE is null)
        AND (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) OR OTHERDURATIONPERCENTAGE is null) 
        AND (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) OR OVERTALKCOUNT is null)
        `;

    let fetchDataQuery = `SELECT COUNT(CONVERSATION_ID)as interactions,
        SUM(CASE WHEN  (CALLDURATION >= (:callFrom)) THEN 1 ELSE 0 END) as callCount,
        SUM(CASE WHEN  (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)) THEN 1 ELSE 0 END) as ACDCount,
        SUM(CASE WHEN  (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo)) THEN 1 ELSE 0 END) as customerCount, 
        SUM(CASE WHEN  (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )THEN 1 ELSE 0 END) as agentCount,
        SUM(CASE WHEN  (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) )THEN 1 ELSE 0 END) as silenceCount,
        SUM(CASE WHEN  (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))THEN 1 ELSE 0 END) as IVRCount,
        SUM(CASE WHEN  (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) ) THEN 1 ELSE 0 END) as othersCount,
        SUM(CASE WHEN  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) ) THEN 1 ELSE 0 END) as overtalkCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchDailyDataQuery = ` SELECT 
        TRUNC(STARTDATE)AS STARTDATE,COUNT(CONVERSATION_ID)as interactions,
        SUM(CASE WHEN  (CALLDURATION >= (:callFrom)) THEN 1 ELSE 0 END) as callCount,
        SUM(CASE WHEN (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)) THEN 1 ELSE 0 END) as ACDCount,
        SUM(CASE WHEN  (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo)) THEN 1 ELSE 0 END) as customerCount, 
        SUM(CASE WHEN  (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )THEN 1 ELSE 0 END) as agentCount,
        SUM(CASE WHEN  (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) )THEN 1 ELSE 0 END) as silenceCount,
        SUM(CASE WHEN  (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))THEN 1 ELSE 0 END) as IVRCount,
        SUM(CASE WHEN  (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) ) THEN 1 ELSE 0 END) as othersCount,
        SUM(CASE WHEN  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) ) THEN 1 ELSE 0 END) as overtalkCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    // Generate placeholders for the filters
    let queueRegex;
    if(queue.length>1){
      queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(queue.length==1){
      queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }

    let workTeamRegex;
    if(workTeams.length>1){
      workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(workTeams.length==1){
      workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    let agentIdRegex;
    if(agentId.length>1){
      agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(agentId.length==1){
      agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
    const placeholdersForMarketSector = marketSector
      .map((_, i) => `:marketSector${i + 1}`)
      .join(", ");
    const placeholdersForDivision = division
    .map((_, i) => `:division${i + 1}`)
    .join(", ");
    const placeholdersForClientId = clientId
      .map((_, i) => `:clientId${i + 1}`)
      .join(", ");
    const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");
    // const placeholdersForSilenceFrom = `:silenceFrom`
    // const placeholdersForSilenceTo = `:silenceTo`

    // Append filters to the queries if they are provided
    if (lob.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchDataQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchDailyDataQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
    }

    if (marketSector.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchDataQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchDailyDataQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
    }
    if (division.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchDataQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchDailyDataQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
    }

    if (queue.length > 0) {
      fetchTotalInteractionsQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchDailyTotalInteractionsQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchDataQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchDailyDataQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
    }

    if (clientId.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchDataQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchDailyDataQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
    }

    if (workTeams.length > 0) {
      fetchTotalInteractionsQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchDailyTotalInteractionsQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchDataQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchDailyDataQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
    }

    if (agentId.length > 0) {
      fetchTotalInteractionsQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchDailyTotalInteractionsQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchDataQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchDailyDataQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
    }

    if (ANI.length > 0) {
      fetchTotalInteractionsQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchDailyTotalInteractionsQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchDataQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchDailyDataQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
    }


    // Prepare binds for query
    const binds = {
      fromDate,
      toDate,
      callFrom: selectedCallDuration,
      ACDFrom: selectedACDTime.from,
      ACDTo: selectedACDTime.to,
      customerFrom: selectedCustomerTime.from,
      customerTo: selectedCustomerTime.to,
      agentFrom: selectedAgentTime.from,
      agentTo: selectedAgentTime.to,
      silenceFrom: selectedSilenceTime.from,
      silenceTo: selectedSilenceTime.to,
      IVRFrom: selectedIVRTime.from,
      IVRTo: selectedIVRTime.to,
      othersFrom: selectedOthersTime.from,
      othersTo: selectedOthersTime.to,
      overtalkFrom: selectedOvertalkCount.from,
      overtalkTo: selectedOvertalkCount.to,
    };
    lob.forEach((lobVal, index) => {
      binds[`lob${index + 1}`] = lobVal;
    });
    marketSector.forEach((marketVal, index) => {
      binds[`marketSector${index + 1}`] = marketVal;
    });
    division.forEach((divisionVal, index) => {
      binds[`division${index + 1}`] = divisionVal;
    });
    clientId.forEach((clientVal, index) => {
      binds[`clientId${index + 1}`] = clientVal;
    });
    ANI.forEach((ANIVal, index) => {
      binds[`ANI${index + 1}`] = ANIVal;
    });
    // console.log(binds);
    // console.log(fetchTotalsQuery);
    fetchDailyDataQuery += `group by TRUNC(STARTDATE)
    ORDER BY STARTDATE`;
    fetchDailyTotalInteractionsQuery += `group by TRUNC(STARTDATE)
    ORDER BY STARTDATE`;
    // Execute current totals query

    // const currentInteractionsTotal = await connection.execute(fetchTotalInteractionsQuery, binds);
    // const currentDailyInteractionTotals = await connection.execute(fetchDailyTotalInteractionsQuery, binds);

  
    const currentDataTotal = await connection.execute(
      fetchDataQuery,
      binds
    );

    const dailyDataResponse = await connection.execute(
      fetchDailyDataQuery,
      binds
    );

   
    // const totalInteractionsTimePeriod = currentDataTotal.rows.map(
    //   (result) => result[0].toISOString().split("T")[0]
    // );
    const interactionsArray = dailyDataResponse.rows.map(
      (result) => result[1]
    );

    const timePeriod = dailyDataResponse.rows.map(
      (result) => result[0].toISOString().split("T")[0]
    );
  
   
  
    // timeSet.forEach((date)=>totalInteractionsTimePeriod.push(date));
    // console.log(totalInteractionsTimePeriod);
    
    // totalInteractionsTimePeriod.forEach((date) => {
    //   // Set to zero if no data is present for that day
    //   if (!interactionsArray[date]) interactionsArray[date] = 0;
    // });
   
    const callDurationTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[2]
    );
    const ACDTrendDataArray = dailyDataResponse.rows.map((result) => result[3]);
    const customerTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[4]
    );
    const agentTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[5]
    );
    const silenceTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[6]
    );
    const IVRTrendDataArray = dailyDataResponse.rows.map((result) => result[7]);
    const othersTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[8]
    );
    const overtalkTrendDataArray = dailyDataResponse.rows.map(
      (result) => result[9]
    );

    let dailyData = {
      interactions: interactionsArray,
      callDuration: callDurationTrendDataArray,
      ACDTrendData: ACDTrendDataArray,
      customerTrendData: customerTrendDataArray,
      agentTrendData: agentTrendDataArray,
      silenceTrendData: silenceTrendDataArray,
      IVRTrendData: IVRTrendDataArray,
      othersTrendData: othersTrendDataArray,
      overtalkTrendData: overtalkTrendDataArray,
    };

    // Execute previous totals query
    const previousDataTotal= await connection.execute(fetchDataQuery, {
      ...binds,
      fromDate: previousFromDate,
      toDate: previousToDate,
    });

    const processTotals = (data1) => ({
      interactions: data1.rows[0][0] || 0, // Set to zero if undefined
      callDurationTrendData: data1.rows[0][1] || 0,
      ACDTrendData: data1.rows[0][2] || 0,
      customerTrendData: data1.rows[0][3] || 0,
      agentTrendData: data1.rows[0][4] || 0,
      silenceTrendData: data1.rows[0][5] || 0,
      IVRTrendData: data1.rows[0][6] || 0,
      othersTrendData: data1.rows[0][7] || 0,
      overtalkTrendData: data1.rows[0][8] || 0,
    });

    const calcPercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.ceil(((current - previous) / previous) * 10000) / 100;
    };

    const current = processTotals(currentDataTotal);
    const previous = processTotals(previousDataTotal);

   
    const summaryData = [
      {
        Header: "Total Interactions",
        Count: current.interactions,
        "Past Count": previous.interactions,
        Trend: calcPercentageChange(
          current.interactions,
          previous.interactions
        ),
      },
      {
        Header: "Call Duration",
        Count: current.callDurationTrendData,
        "Past Count": previous.callDurationTrendData,
        Trend: calcPercentageChange(
          current.callDurationTrendData,
          previous.callDurationTrendData
        ),
      },
      {
        Header: "Queue Wait Time %",
        Count: current.ACDTrendData,
        "Past Count": previous.ACDTrendData,
        Trend: calcPercentageChange(
          current.ACDTrendData,
          previous.ACDTrendData
        ),
      },
      {
        Header: "Customer Talk Time %",
        Count: current.customerTrendData,
        "Past Count": previous.customerTrendData,
        Trend: calcPercentageChange(
          current.customerTrendData,
          previous.customerTrendData
        ),
      },
      {
        Header: "Agent Talk Time %",
        Count: current.agentTrendData,
        "Past Count": previous.agentTrendData,
        Trend: calcPercentageChange(
          current.agentTrendData,
          previous.agentTrendData
        ),
      },
      {
        Header: "Silence Time %",
        Count: current.silenceTrendData,
        "Past Count": previous.silenceTrendData,
        Trend: calcPercentageChange(
          current.silenceTrendData,
          previous.silenceTrendData
        ),
      },
      {
        Header: "IVR Time %",
        Count: current.IVRTrendData,
        "Past Count": previous.IVRTrendData,
        Trend: calcPercentageChange(
          current.IVRTrendData,
          previous.IVRTrendData
        ),
      },
      {
        Header: "Other(Hold/Noise/SP) Time %",
        Count: current.othersTrendData,
        "Past Count": previous.othersTrendData,
        Trend: calcPercentageChange(
          current.othersTrendData,
          previous.othersTrendData
        ),
      },
      {
        Header: "Overtalk Count",
        Count: current.overtalkTrendData,
        "Past Count": previous.overtalkTrendData,
        Trend: calcPercentageChange(
          current.overtalkTrendData,
          previous.overtalkTrendData
        ),
      },
    ];
    // console.log({
    //   currentPeriod: { ...current },
    //   previousPeriod: { ...previous },
    //   percentChanges,
    //   dailyData: dailyData,
    //   timePeriod: timePeriod,
    //   totalInteractionsTimePeriod: totalInteractionsTimePeriod,
    //   FeedSuccess: "True",
    // });

    res.json({
      summaryData: summaryData,
    });
  } catch (error) {
    console.error(error);
    res.json({ FeedFail: "True" });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

app.post("/groupedData", async (req, res) => {
  console.log("Grouped ROUTE");
  const targetFormatter = "yyyy-MM-dd";
  let fromDate = req.body.startDate;
  let toDate = req.body.endDate;
  let selectedCallDuration = req.body.selectedCallDuration;
  let selectedACDTime = req.body.selectedACDTime;
  let selectedCustomerTime = req.body.selectedCustomerTime;
  let selectedAgentTime = req.body.selectedAgentTime;
  let selectedSilenceTime = req.body.selectedSilenceTime;
  let selectedIVRTime = req.body.selectedIVRTime;
  let selectedOthersTime = req.body.selectedOthersTime;
  let selectedOvertalkCount = req.body.selectedOvertalkCount;
  // Extract filters
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];
  let selectedGroup = req.body.group || "LOB";

  let connection;

  try {
    // Format and validate input date
    fromDate = format(parseISO(fromDate), targetFormatter);
    toDate = format(parseISO(toDate), targetFormatter);

    const period = differenceInDays(toDate, fromDate) + 1;
    console.log("period", period);

    const previousFromDate = format(
      subDays(parseISO(fromDate), period),
      targetFormatter
    );

    const previousToDate = format(
      subDays(parseISO(fromDate), 1),
      targetFormatter
    );
    console.log("Past Date", previousFromDate, " ", previousToDate);

    connection = await oracledb.getConnection(dbConfig);
    const placeholdersForGroup = selectedGroup;

    let fetchGroupDataCallQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (CALLDURATION >= (:callFrom)) THEN 1 ELSE 0 END) as callCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataACDQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)) THEN 1 ELSE 0 END) as ACDCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')  
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataCustomerQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo)) THEN 1 ELSE 0 END) as customerCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')   
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataAgentQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
      
        SUM(CASE WHEN  (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )THEN 1 ELSE 0 END) as agentCount
     
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')   
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataSilenceQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
      
        SUM(CASE WHEN  (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) )THEN 1 ELSE 0 END) as silenceCount
       
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')   
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataIVRQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))THEN 1 ELSE 0 END) as IVRCount
      
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')   
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataOthersQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
      
        SUM(CASE WHEN  (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) ) THEN 1 ELSE 0 END) as othersCount
        
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')   
        AND ${placeholdersForGroup} IS NOT NULL`;

    let fetchGroupDataOvertalkQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) ) THEN 1 ELSE 0 END) as overtalkCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')   
        AND ${placeholdersForGroup} IS NOT NULL`;

    // Generate placeholders for the filters

    let queueRegex;
    if(queue.length>1){
      queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(queue.length==1){
      queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
    let workTeamRegex;
    if(workTeams.length>1){
      workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(workTeams.length==1){
      workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    let agentIdRegex;
    if(agentId.length>1){
      agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(agentId.length==1){
      agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
    const placeholdersForMarketSector = marketSector
      .map((_, i) => `:marketSector${i + 1}`)
      .join(", ");
    const placeholdersForDivision = division
    .map((_, i) => `:division${i + 1}`)
    .join(", ");
    const placeholdersForClientId = clientId
      .map((_, i) => `:clientId${i + 1}`)
      .join(", ");
    const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");
    // const placeholdersForSilenceFrom = `:silenceFrom`
    // const placeholdersForSilenceTo = `:silenceTo`

    // Append filters to the queries if they are provided
    if (lob.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataACDQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataAgentQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataIVRQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOthersQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
    }

    if (marketSector.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataACDQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataAgentQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataIVRQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOthersQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
    }
    if (division.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataACDQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataAgentQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataIVRQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataOthersQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
    }

    if (queue.length > 0) {
      fetchGroupDataCallQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataACDQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataCustomerQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataAgentQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataSilenceQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataIVRQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOthersQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOvertalkQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
    }

    if (clientId.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataACDQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataAgentQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataIVRQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOthersQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
    }

    if (workTeams.length > 0) {
      fetchGroupDataCallQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataACDQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataCustomerQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataAgentQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataSilenceQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataIVRQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOthersQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOvertalkQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
    }

    if (agentId.length > 0) {
      fetchGroupDataCallQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataACDQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataCustomerQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataAgentQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataSilenceQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataIVRQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOthersQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOvertalkQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
    }

    if (ANI.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataACDQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataAgentQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataIVRQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOthersQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
    }

    // Prepare binds for query
    const binds = {
      fromDate,
      toDate,
    };
    lob.forEach((lobVal, index) => {
      binds[`lob${index + 1}`] = lobVal;
    });
    marketSector.forEach((marketVal, index) => {
      binds[`marketSector${index + 1}`] = marketVal;
    });
    division.forEach((divisionVal, index) => {
      binds[`division${index + 1}`] = divisionVal;
    });
    clientId.forEach((clientVal, index) => {
      binds[`clientId${index + 1}`] = clientVal;
    });
    ANI.forEach((ANIVal, index) => {
      binds[`ANI${index + 1}`] = ANIVal;
    });


    fetchGroupDataCallQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY callCount DESC`;
    fetchGroupDataACDQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY ACDCount DESC`;
    fetchGroupDataCustomerQuery += ` GROUP BY(${placeholdersForGroup}) ORDER BY customerCount DESC`;
    fetchGroupDataAgentQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY agentCount DESC`;
    fetchGroupDataSilenceQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY silenceCount DESC`;
    fetchGroupDataIVRQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY IVRCount DESC`;
    fetchGroupDataOthersQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY othersCount DESC`;
    fetchGroupDataOvertalkQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY overtalkCount DESC`;

    // console.log(fetchGroupDataCallQuery,"\nACD",
    // fetchGroupDataACDQuery,"\nCustomer",
    // fetchGroupDataCustomerQuery,"\nAgent",
    // fetchGroupDataAgentQuery,"\nSilence",
    // fetchGroupDataSilenceQuery ,"\nIVR",
    // fetchGroupDataIVRQuery,"\nOthers",
    // fetchGroupDataOthersQuery,"\nOVERTALK",
    // fetchGroupDataOvertalkQuery);

    const binds1 = {
      ...binds,
      callFrom: selectedCallDuration,
    };
    const binds2 = {
      ...binds,
      ACDTo: selectedACDTime.to,
      ACDFrom: selectedACDTime.from,
    };
    const binds3 = {
      ...binds,
      customerFrom: selectedCustomerTime.from,
      customerTo: selectedCustomerTime.to,
    };
    const binds4 = {
      ...binds,
      agentFrom: selectedAgentTime.from,
      agentTo: selectedAgentTime.to,
    };
    const binds5 = {
      ...binds,
      silenceFrom: selectedSilenceTime.from,
      silenceTo: selectedSilenceTime.to,
    };
    const binds6 = {
      ...binds,
      IVRFrom: selectedIVRTime.from,
      IVRTo: selectedIVRTime.to,
    };
    const binds7 = {
      ...binds,
      othersFrom: selectedOthersTime.from,
      othersTo: selectedOthersTime.to,
    };
    const binds8 = {
      ...binds,
      overtalkFrom: selectedOvertalkCount.from,
      overtalkTo: selectedOvertalkCount.to,
    };
    const resp1 = await connection.execute(fetchGroupDataCallQuery, binds1);

    const resp2 = await connection.execute(fetchGroupDataACDQuery, binds2);

    const resp3 = await connection.execute(fetchGroupDataCustomerQuery, binds3);

    const resp4 = await connection.execute(fetchGroupDataAgentQuery, binds4);

    const resp5 = await connection.execute(fetchGroupDataSilenceQuery, binds5);
    const resp6 = await connection.execute(fetchGroupDataIVRQuery, binds6);

    const resp7 = await connection.execute(fetchGroupDataOthersQuery, binds7);

    const resp8 = await connection.execute(fetchGroupDataOvertalkQuery, binds8);

    const group1 = resp1.rows.map((result) => result[0]);
    const countArray1 = resp1.rows.map((result) => result[2]);

    const group2 = resp2.rows.map((result) => result[0]);
    const countArray2 = resp2.rows.map((result) => result[2]);

    const group3 = resp3.rows.map((result) => result[0]);
    const countArray3 = resp3.rows.map((result) => result[2]);

    const group4 = resp4.rows.map((result) => result[0]);
    const countArray4 = resp4.rows.map((result) => result[2]);

    const group5 = resp5.rows.map((result) => result[0]);
    const countArray5 = resp5.rows.map((result) => result[2]);

    const group6 = resp6.rows.map((result) => result[0]);
    const countArray6 = resp6.rows.map((result) => result[2]);

    const group7 = resp7.rows.map((result) => result[0]);
    const countArray7 = resp7.rows.map((result) => result[2]);

    const group8 = resp8.rows.map((result) => result[0]);
    const countArray8 = resp8.rows.map((result) => result[2]);

    // console.log({
    //   callGroupData:{group:group1,count:countArray1},
    //   ACDGroupData: {group:group2,count:countArray2},
    //   customerGroupData: {group:group3,count:countArray3},
    //   agentGroupData: {group:group4,count:countArray4},
    //   silenceGroupData: {group:group5,count:countArray5},
    //   IVRGroupData: {group:group6,count:countArray6},
    //   othersGroupData: {group:group7,count:countArray7},
    //   overtalkGroupData: {group:group8,count:countArray8},
    // });

    res.json({
      callGroupData: { group: group1, count: countArray1 },
      ACDGroupData: { group: group2, count: countArray2 },
      customerGroupData: { group: group3, count: countArray3 },
      agentGroupData: { group: group4, count: countArray4 },
      silenceGroupData: { group: group5, count: countArray5 },
      IVRGroupData: { group: group6, count: countArray6 },
      othersGroupData: { group: group7, count: countArray7 },
      overtalkGroupData: { group: group8, count: countArray8 },
      FeedSuccess: "True",
    });
  } catch (error) {
    console.error(error);
    res.json({ FeedFail: "True" });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});


app.post("/stackedData", async (req, res) => {
  console.log("Stacked ROUTE");
  const targetFormatter = "yyyy-MM-dd";
  let fromDate = req.body.currentDate;
  let toDate = req.body.currentDate;
  let selectedCallDuration = req.body.selectedCallDuration;
  let selectedACDTime = req.body.selectedACDTime;
  let selectedCustomerTime = req.body.selectedCustomerTime;
  let selectedAgentTime = req.body.selectedAgentTime;
  let selectedSilenceTime = req.body.selectedSilenceTime;
  let selectedIVRTime = req.body.selectedIVRTime;
  let selectedOthersTime = req.body.selectedOthersTime;
  let selectedOvertalkCount = req.body.selectedOvertalkCount;
  // Extract filters
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];

  let connection;

  try {
    // Format and validate input date
    console.log("Past Date", fromDate, " ", toDate);
    fromDate = format(parseISO(fromDate), targetFormatter);
    toDate = format(parseISO(toDate), targetFormatter);

    connection = await oracledb.getConnection(dbConfig);

    let fetchGroupDataCallQuery = ` SELECT * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (CALLDURATION >= (:callFrom))`;

    let fetchGroupDataACDQuery = ` SELECT * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo))`;

    let fetchGroupDataCustomerQuery = ` SELECT * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo))`;

    let fetchGroupDataAgentQuery = ` SELECT * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )`;

    let fetchGroupDataSilenceQuery = ` SELECT * FROM 
    CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo))`;

    let fetchGroupDataIVRQuery = ` SELECT  * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))`;

    let fetchGroupDataOthersQuery = ` SELECT  * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo)) `;

    let fetchGroupDataOvertalkQuery = ` SELECT * FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo)) `;

    // Generate placeholders for the filters

    let queueRegex;
    if(queue.length>1){
      queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(queue.length==1){
      queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
    let workTeamRegex;
    if(workTeams.length>1){
      workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(workTeams.length==1){
      workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    let agentIdRegex;
    if(agentId.length>1){
      agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(agentId.length==1){
      agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
    const placeholdersForMarketSector = marketSector
      .map((_, i) => `:marketSector${i + 1}`)
      .join(", ");
    const placeholdersForDivision = division
    .map((_, i) => `:division${i + 1}`)
    .join(", ");
    const placeholdersForClientId = clientId
      .map((_, i) => `:clientId${i + 1}`)
      .join(", ");
    const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");
    // const placeholdersForSilenceFrom = `:silenceFrom`
    // const placeholdersForSilenceTo = `:silenceTo`

    // Append filters to the queries if they are provided
    // Append filters to the queries if they are provided
    if (lob.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataACDQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataAgentQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataIVRQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOthersQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
    }

    if (marketSector.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataACDQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataAgentQuery += `AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataIVRQuery += `AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOthersQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
    }
    if (division.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataACDQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataAgentQuery += `AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataIVRQuery += `AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataOthersQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
    }

    if (queue.length > 0) {
      fetchGroupDataCallQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataACDQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataCustomerQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataAgentQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataSilenceQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataIVRQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOthersQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOvertalkQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
    }

    if (clientId.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataACDQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataAgentQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataIVRQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOthersQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientID})`;
    }

    if (workTeams.length > 0) {
      fetchGroupDataCallQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataACDQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataCustomerQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataAgentQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataSilenceQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataIVRQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOthersQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOvertalkQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
    }

    if (agentId.length > 0) {
      fetchGroupDataCallQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataACDQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataCustomerQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataAgentQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataSilenceQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataIVRQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOthersQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOvertalkQuery += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
    }

    if (ANI.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataACDQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataAgentQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataIVRQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOthersQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
    }


    // Prepare binds for query
    const binds = {
      fromDate,
      toDate,
    };
    lob.forEach((lobVal, index) => {
      binds[`lob${index + 1}`] = lobVal;
    });
    marketSector.forEach((marketVal, index) => {
      binds[`marketSector${index + 1}`] = marketVal;
    });
    division.forEach((divisionVal, index) => {
      binds[`division${index + 1}`] = divisionVal;
    });
    clientId.forEach((clientVal, index) => {
      binds[`clientId${index + 1}`] = clientVal;
    });
    ANI.forEach((ANIVal, index) => {
      binds[`ANI${index + 1}`] = ANIVal;
    });

    fetchGroupDataCallQuery += ` ORDER BY CALLDURATION DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataACDQuery += ` ORDER BY ACDDURATIONPERCENTAGE DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataCustomerQuery += ` ORDER BY CUSTOMERDURATIONPERCENTAGE DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataAgentQuery += ` ORDER BY AGENTDURATIONPERCENTAGE DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataSilenceQuery += ` ORDER BY SILENCEDURATIONPERCENTAGE DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataIVRQuery += ` ORDER BY IVRDURATIONPERCENTAGE DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataOthersQuery += ` ORDER BY OTHERDURATIONPERCENTAGE DESC FETCH FIRST 500 ROWS ONLY`;
    fetchGroupDataOvertalkQuery += ` ORDER BY OVERTALKCOUNT DESC FETCH FIRST 500 ROWS ONLY`;

    const binds1 = {
      ...binds,
      callFrom: selectedCallDuration,
    };
    const binds2 = {
      ...binds,
      ACDTo: selectedACDTime.to,
      ACDFrom: selectedACDTime.from,
    };
    const binds3 = {
      ...binds,
      customerFrom: selectedCustomerTime.from,
      customerTo: selectedCustomerTime.to,
    };
    const binds4 = {
      ...binds,
      agentFrom: selectedAgentTime.from,
      agentTo: selectedAgentTime.to,
    };
    const binds5 = {
      ...binds,
      silenceFrom: selectedSilenceTime.from,
      silenceTo: selectedSilenceTime.to,
    };
    const binds6 = {
      ...binds,
      IVRFrom: selectedIVRTime.from,
      IVRTo: selectedIVRTime.to,
    };
    const binds7 = {
      ...binds,
      othersFrom: selectedOthersTime.from,
      othersTo: selectedOthersTime.to,
    };
    const binds8 = {
      ...binds,
      overtalkFrom: selectedOvertalkCount.from,
      overtalkTo: selectedOvertalkCount.to,
    };
    
    const resp1 = await connection.execute(fetchGroupDataCallQuery, binds1);

    const resp2 = await connection.execute(fetchGroupDataACDQuery, binds2);

    const resp3 = await connection.execute(fetchGroupDataCustomerQuery, binds3);

    const resp4 = await connection.execute(fetchGroupDataAgentQuery, binds4);

    const resp5 = await connection.execute(fetchGroupDataSilenceQuery, binds5);
    const resp6 = await connection.execute(fetchGroupDataIVRQuery, binds6);

    const resp7 = await connection.execute(fetchGroupDataOthersQuery, binds7);

    const resp8 = await connection.execute(fetchGroupDataOvertalkQuery, binds8);
    

    // console.log({
    //   callStackData: resp1.rows,
    //   ACDStackData: resp2.rows,
    //   customerStackData: resp3.rows,
    //   agentStackData: resp4.rows,
    //   silenceStackData: resp5.rows,
    //   IVRStackData: resp6.rows,
    //   othersStackData: resp7.rows,
    //   overtalkStackData: resp8.rows,
    // });

    res.json({
      callStackData: resp1.rows,
      ACDStackData: resp2.rows,
      customerStackData: resp3.rows,
      agentStackData: resp4.rows,
      silenceStackData: resp5.rows,
      IVRStackData: resp6.rows,
      othersStackData: resp7.rows,
      overtalkStackData: resp8.rows,
      FeedSuccess: "True",
    });
  } catch (error) {
    console.error(error);
    res.json({ FeedFail: "True" });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

app.post("/groupedDownloadData", async (req, res) => {
  console.log("DOWNLOAD Grouped ROUTE");
  const targetFormatter = "yyyy-MM-dd";
  let fromDate = req.body.startDate;
  let toDate = req.body.endDate;
  let selectedCallDuration = req.body.selectedCallDuration;
  let selectedACDTime = req.body.selectedACDTime;
  let selectedCustomerTime = req.body.selectedCustomerTime;
  let selectedAgentTime = req.body.selectedAgentTime;
  let selectedSilenceTime = req.body.selectedSilenceTime;
  let selectedIVRTime = req.body.selectedIVRTime;
  let selectedOthersTime = req.body.selectedOthersTime;
  let selectedOvertalkCount = req.body.selectedOvertalkCount;
  // Extract filters
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];
  let selectedGroup = req.body.group || "LOB";

  let connection;

  try {
    // Format and validate input date
    fromDate = format(parseISO(fromDate), targetFormatter);
    toDate = format(parseISO(toDate), targetFormatter);

    const period = differenceInDays(toDate, fromDate) + 1;
    console.log("period", period);

    const previousFromDate = format(
      subDays(parseISO(fromDate), period),
      targetFormatter
    );

    const previousToDate = format(
      subDays(parseISO(fromDate), 1),
      targetFormatter
    );
    console.log("Past Date", previousFromDate, " ", previousToDate);

    connection = await oracledb.getConnection(dbConfig);
    const placeholdersForGroup = selectedGroup;

    let fetchGroupDataCallQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (CALLDURATION >= (:callFrom)) THEN 1 ELSE 0 END) as callCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataACDQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo)) THEN 1 ELSE 0 END) as ACDCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataCustomerQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo)) THEN 1 ELSE 0 END) as customerCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataAgentQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
      
        SUM(CASE WHEN  (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )THEN 1 ELSE 0 END) as agentCount
     
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataSilenceQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
      
        SUM(CASE WHEN  (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo) )THEN 1 ELSE 0 END) as silenceCount
       
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataIVRQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))THEN 1 ELSE 0 END) as IVRCount
      
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataOthersQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
      
        SUM(CASE WHEN  (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo) ) THEN 1 ELSE 0 END) as othersCount
        
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    let fetchGroupDataOvertalkQuery = ` SELECT 
        ${placeholdersForGroup} ,COUNT(CONVERSATION_ID) AS interactions,
        SUM(CASE WHEN  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo) ) THEN 1 ELSE 0 END) as overtalkCount
      FROM 
        CLOUD_STA_IXNS 
      WHERE 
        TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')`;

    // Generate placeholders for the filters

    let queueRegex;
    if(queue.length>1){
      queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(queue.length==1){
      queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
    let workTeamRegex;
    if(workTeams.length>1){
      workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(workTeams.length==1){
      workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    let agentIdRegex;
    if(agentId.length>1){
      agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(agentId.length==1){
      agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
    const placeholdersForMarketSector = marketSector
      .map((_, i) => `:marketSector${i + 1}`)
      .join(", ");
    const placeholdersForDivision = division
    .map((_, i) => `:division${i + 1}`)
    .join(", ");
    const placeholdersForClientId = clientId
      .map((_, i) => `:clientId${i + 1}`)
      .join(", ");
    const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");
    // const placeholdersForSilenceFrom = `:silenceFrom`
    // const placeholdersForSilenceTo = `:silenceTo`

    // Append filters to the queries if they are provided
    if (lob.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataACDQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataAgentQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataIVRQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOthersQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
    }

    if (marketSector.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataACDQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataAgentQuery += `AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataIVRQuery += `AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOthersQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
    }
    if (division.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataACDQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataAgentQuery += `AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataIVRQuery += `AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataOthersQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
    }

    if (queue.length > 0) {
      fetchGroupDataCallQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataACDQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataCustomerQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataAgentQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataSilenceQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataIVRQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOthersQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOvertalkQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
    }

    if (clientId.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataACDQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataAgentQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataIVRQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOthersQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
    }
    if (workTeams.length > 0) {
      fetchGroupDataCallQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataACDQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataCustomerQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataAgentQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataSilenceQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataIVRQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOthersQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOvertalkQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
    }

    if (agentId.length > 0) {
      fetchGroupDataCallQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataACDQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataCustomerQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataAgentQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataSilenceQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataIVRQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOthersQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOvertalkQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
    }

    if (ANI.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataACDQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataAgentQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataIVRQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOthersQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
    }


    // Prepare binds for query
    const binds = {
      fromDate,
      toDate,
    };
    lob.forEach((lobVal, index) => {
      binds[`lob${index + 1}`] = lobVal;
    });
    marketSector.forEach((marketVal, index) => {
      binds[`marketSector${index + 1}`] = marketVal;
    });
    division.forEach((divisionVal, index) => {
      binds[`division${index + 1}`] = divisionVal;
    });
    clientId.forEach((clientVal, index) => {
      binds[`clientId${index + 1}`] = clientVal;
    });
    ANI.forEach((ANIVal, index) => {
      binds[`ANI${index + 1}`] = ANIVal;
    });

    fetchGroupDataCallQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY callCount DESC`;
    fetchGroupDataACDQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY ACDCount DESC`;
    fetchGroupDataCustomerQuery += ` GROUP BY(${placeholdersForGroup}) ORDER BY customerCount DESC`;
    fetchGroupDataAgentQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY agentCount DESC`;
    fetchGroupDataSilenceQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY silenceCount DESC`;
    fetchGroupDataIVRQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY IVRCount DESC`;
    fetchGroupDataOthersQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY othersCount DESC`;
    fetchGroupDataOvertalkQuery += ` GROUP BY (${placeholdersForGroup}) ORDER BY overtalkCount DESC`;

    // console.log(fetchGroupDataCallQuery,"\nACD",
    // fetchGroupDataACDQuery,"\nCustomer",
    // fetchGroupDataCustomerQuery,"\nAgent",
    // fetchGroupDataAgentQuery,"\nSilence",
    // fetchGroupDataSilenceQuery ,"\nIVR",
    // fetchGroupDataIVRQuery,"\nOthers",
    // fetchGroupDataOthersQuery,"\nOVERTALK",
    // fetchGroupDataOvertalkQuery);

    const binds1 = {
      ...binds,
      callFrom: selectedCallDuration,
    };
    const binds2 = {
      ...binds,
      ACDTo: selectedACDTime.to,
      ACDFrom: selectedACDTime.from,
    };
    const binds3 = {
      ...binds,
      customerFrom: selectedCustomerTime.from,
      customerTo: selectedCustomerTime.to,
    };
    const binds4 = {
      ...binds,
      agentFrom: selectedAgentTime.from,
      agentTo: selectedAgentTime.to,
    };
    const binds5 = {
      ...binds,
      silenceFrom: selectedSilenceTime.from,
      silenceTo: selectedSilenceTime.to,
    };
    const binds6 = {
      ...binds,
      IVRFrom: selectedIVRTime.from,
      IVRTo: selectedIVRTime.to,
    };
    const binds7 = {
      ...binds,
      othersFrom: selectedOthersTime.from,
      othersTo: selectedOthersTime.to,
    };
    const binds8 = {
      ...binds,
      overtalkFrom: selectedOvertalkCount.from,
      overtalkTo: selectedOvertalkCount.to,
    };
    const resp1 = await connection.execute(fetchGroupDataCallQuery, binds1);

    const resp2 = await connection.execute(fetchGroupDataACDQuery, binds2);

    const resp3 = await connection.execute(fetchGroupDataCustomerQuery, binds3);

    const resp4 = await connection.execute(fetchGroupDataAgentQuery, binds4);

    const resp5 = await connection.execute(fetchGroupDataSilenceQuery, binds5);
    const resp6 = await connection.execute(fetchGroupDataIVRQuery, binds6);

    const resp7 = await connection.execute(fetchGroupDataOthersQuery, binds7);

    const resp8 = await connection.execute(fetchGroupDataOvertalkQuery, binds8);

    const group1 = resp1.rows.map((result) => result[0]);
    const countArray1 = resp1.rows.map((result) => result[2]);

    const group2 = resp2.rows.map((result) => result[0]);
    const countArray2 = resp2.rows.map((result) => result[2]);

    const group3 = resp3.rows.map((result) => result[0]);
    const countArray3 = resp3.rows.map((result) => result[2]);

    const group4 = resp4.rows.map((result) => result[0]);
    const countArray4 = resp4.rows.map((result) => result[2]);

    const group5 = resp5.rows.map((result) => result[0]);
    const countArray5 = resp5.rows.map((result) => result[2]);

    const group6 = resp6.rows.map((result) => result[0]);
    const countArray6 = resp6.rows.map((result) => result[2]);

    const group7 = resp7.rows.map((result) => result[0]);
    const countArray7 = resp7.rows.map((result) => result[2]);

    const group8 = resp8.rows.map((result) => result[0]);
    const countArray8 = resp8.rows.map((result) => result[2]);

    // console.log({
    //   callGroupData:{group:group1,count:countArray1},
    //   ACDGroupData: {group:group2,count:countArray2},
    //   customerGroupData: {group:group3,count:countArray3},
    //   agentGroupData: {group:group4,count:countArray4},
    //   silenceGroupData: {group:group5,count:countArray5},
    //   IVRGroupData: {group:group6,count:countArray6},
    //   othersGroupData: {group:group7,count:countArray7},
    //   overtalkGroupData: {group:group8,count:countArray8},
    // });

    res.json({
      callGroupData: { group: group1, count: countArray1 },
      ACDGroupData: { group: group2, count: countArray2 },
      customerGroupData: { group: group3, count: countArray3 },
      agentGroupData: { group: group4, count: countArray4 },
      silenceGroupData: { group: group5, count: countArray5 },
      IVRGroupData: { group: group6, count: countArray6 },
      othersGroupData: { group: group7, count: countArray7 },
      overtalkGroupData: { group: group8, count: countArray8 },
      FeedSuccess: "True",
    });
  } catch (error) {
    console.error(error);
    res.json({ FeedFail: "True" });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

app.post("/stackedDownloadData", async (req, res) =>{
  console.log("DOWNLOAD Stacked ROUTE");
  const targetFormatter = "yyyy-MM-dd";
  let fromDate = req.body.startDate;
  let toDate = req.body.endDate;
  let selectedCallDuration = req.body.selectedCallDuration;
  let selectedACDTime = req.body.selectedACDTime;
  let selectedCustomerTime = req.body.selectedCustomerTime;
  let selectedAgentTime = req.body.selectedAgentTime;
  let selectedSilenceTime = req.body.selectedSilenceTime;
  let selectedIVRTime = req.body.selectedIVRTime;
  let selectedOthersTime = req.body.selectedOthersTime;
  let selectedOvertalkCount = req.body.selectedOvertalkCount;
  // Extract filters
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];

  let connection;

  try {
    // Format and validate input date
    console.log("Past Date", fromDate, " ", toDate);
    fromDate = format(parseISO(fromDate), targetFormatter);
    toDate = format(parseISO(toDate), targetFormatter);
    connection = await oracledb.getConnection(dbConfig);

    let fetchGroupDataCallQuery = ` SELECT CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (CALLDURATION >= (:callFrom))`;

    let fetchGroupDataACDQuery = ` SELECT CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (ACDDURATIONPERCENTAGE >= (:ACDFrom) AND ACDDURATIONPERCENTAGE <= (:ACDTo))`;

    let fetchGroupDataCustomerQuery = ` SELECT CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (CUSTOMERDURATIONPERCENTAGE >= (:customerFrom) AND CUSTOMERDURATIONPERCENTAGE <= (:customerTo))`;

    let fetchGroupDataAgentQuery = ` SELECT CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (AGENTDURATIONPERCENTAGE >= (:agentFrom) AND AGENTDURATIONPERCENTAGE <= (:agentTo) )`;

    let fetchGroupDataSilenceQuery = ` SELECT CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM 
    CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (SILENCEDURATIONPERCENTAGE >= (:silenceFrom) AND SILENCEDURATIONPERCENTAGE <= (:silenceTo))`;

    let fetchGroupDataIVRQuery = ` SELECT  CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (IVRDURATIONPERCENTAGE >= (:IVRFrom) AND IVRDURATIONPERCENTAGE <= (:IVRTo))`;

    let fetchGroupDataOthersQuery = ` SELECT  CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND (OTHERDURATIONPERCENTAGE >= (:othersFrom) AND OTHERDURATIONPERCENTAGE <= (:othersTo)) `;

    let fetchGroupDataOvertalkQuery = ` SELECT CLOUD_STA_IXNS.*,TO_CHAR(STARTDATE,'DD/MM/YYYY,HH:MI:SS AM')AS STARTDATE FROM CLOUD_STA_IXNS 
    WHERE 
      TRUNC(startdate) BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD') AND TO_DATE(:toDate, 'YYYY-MM-DD')
      AND  (OVERTALKCOUNT >= (:overtalkFrom) AND OVERTALKCOUNT <= (:overtalkTo)) `;

    // Generate placeholders for the filters
    let queueRegex;
    if(queue.length>1){
      queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(queue.length==1){
      queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
    let workTeamRegex;
    if(workTeams.length>1){
      workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(workTeams.length==1){
      workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    let agentIdRegex;
    if(agentId.length>1){
      agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
    }else if(agentId.length==1){
      agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
    }
  
    const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
    const placeholdersForMarketSector = marketSector
      .map((_, i) => `:marketSector${i + 1}`)
      .join(", ");
    const placeholdersForDivision = division
    .map((_, i) => `:division${i + 1}`)
    .join(", ");
    const placeholdersForClientId = clientId
      .map((_, i) => `:clientId${i + 1}`)
      .join(", ");
    const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

    // const placeholdersForSilenceFrom = `:silenceFrom`
    // const placeholdersForSilenceTo = `:silenceTo`

    // Append filters to the queries if they are provided
    // Append filters to the queries if they are provided
    if (lob.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataACDQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataAgentQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataIVRQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOthersQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
    }

    if (marketSector.length > 0) {
      fetchGroupDataCallQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataACDQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataCustomerQuery += `  AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataAgentQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataIVRQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOthersQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
    }
    if (division.length > 0) {
      fetchGroupDataCallQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataACDQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataCustomerQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataAgentQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataSilenceQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataIVRQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOthersQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
      fetchGroupDataOvertalkQuery += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
    }

    if (queue.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataACDQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataAgentQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataIVRQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataOthersQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(QUEUE) IN (${placeholdersForQueue})`;
    }

    if (clientId.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataACDQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataAgentQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataIVRQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOthersQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
    }

    if (workTeams.length > 0) {
      fetchGroupDataCallQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataACDQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataCustomerQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataAgentQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataSilenceQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataIVRQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOthersQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
      fetchGroupDataOvertalkQuery +=` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
    }

    if (agentId.length > 0) {
      fetchGroupDataCallQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataACDQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataCustomerQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataAgentQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataSilenceQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataIVRQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOthersQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
      fetchGroupDataOvertalkQuery +=` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
    }

    if (ANI.length > 0) {
      fetchGroupDataCallQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataACDQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataCustomerQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataAgentQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataSilenceQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataIVRQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOthersQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
      fetchGroupDataOvertalkQuery += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
    }

    // Prepare binds for query
    const binds = {
      fromDate,
      toDate,
    };
    lob.forEach((lobVal, index) => {
      binds[`lob${index + 1}`] = lobVal;
    });
    marketSector.forEach((marketVal, index) => {
      binds[`marketSector${index + 1}`] = marketVal;
    });
    division.forEach((divisionVal, index) => {
      binds[`division${index + 1}`] = divisionVal;
    });
    clientId.forEach((clientVal, index) => {
      binds[`clientId${index + 1}`] = clientVal;
    });
    ANI.forEach((ANIVal, index) => {
      binds[`ANI${index + 1}`] = ANIVal;
    });


    fetchGroupDataCallQuery += ` ORDER BY CALLDURATION DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataACDQuery += ` ORDER BY ACDDURATIONPERCENTAGE DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataCustomerQuery += ` ORDER BY CUSTOMERDURATIONPERCENTAGE DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataAgentQuery += ` ORDER BY AGENTDURATIONPERCENTAGE DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataSilenceQuery += ` ORDER BY SILENCEDURATIONPERCENTAGE DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataIVRQuery += ` ORDER BY IVRDURATIONPERCENTAGE DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataOthersQuery += ` ORDER BY OTHERDURATIONPERCENTAGE DESC FETCH FIRST 5000 ROWS ONLY`;
    fetchGroupDataOvertalkQuery += ` ORDER BY OVERTALKCOUNT DESC FETCH FIRST 5000 ROWS ONLY`;
    // console.log(fetchGroupDataCallQuery,"\nACD",
    // fetchGroupDataACDQuery,"\nCustomer",
    // fetchGroupDataCustomerQuery,"\nAgent",
    // fetchGroupDataAgentQuery,"\nSilence",
    // fetchGroupDataSilenceQuery ,"\nIVR",
    // fetchGroupDataIVRQuery,"\nOthers",
    // fetchGroupDataOthersQuery,"\nOVERTALK",
    // fetchGroupDataOvertalkQuery);
    const binds1 = {
      ...binds,
      callFrom: selectedCallDuration,
    };
    const binds2 = {
      ...binds,
      ACDTo: selectedACDTime.to,
      ACDFrom: selectedACDTime.from,
    };
    const binds3 = {
      ...binds,
      customerFrom: selectedCustomerTime.from,
      customerTo: selectedCustomerTime.to,
    };
    const binds4 = {
      ...binds,
      agentFrom: selectedAgentTime.from,
      agentTo: selectedAgentTime.to,
    };
    const binds5 = {
      ...binds,
      silenceFrom: selectedSilenceTime.from,
      silenceTo: selectedSilenceTime.to,
    };
    const binds6 = {
      ...binds,
      IVRFrom: selectedIVRTime.from,
      IVRTo: selectedIVRTime.to,
    };
    const binds7 = {
      ...binds,
      othersFrom: selectedOthersTime.from,
      othersTo: selectedOthersTime.to,
    };
    const binds8 = {
      ...binds,
      overtalkFrom: selectedOvertalkCount.from,
      overtalkTo: selectedOvertalkCount.to,
    };

    const convertTime = (utcString) => {
      let utcDate = new Date(utcString);

      let localTimeString = utcDate.toLocaleString();
     
      
      return localTimeString;
    };

    // console.log("1",binds1,"                   ",fetchGroupDataCallQuery);
    const processTotals = (item) => ({
      //"Start Date": item[0],
      "Start Date": convertTime(item[0]),
      "Conversation ID": item[1],
      LOB: item[3],
      "Market Type": item[16]||"NULL",
      "Division": item[27],
      Queue: item[2],
      "Client ID": item[17]||"NA",
      "Work Teams": item[24]||"NULL",
      "Agent Name": item[4],
      ANI: item[18]||"NA",
      "Party ID": item[19]||"NULL",
      "Call Duration": item[5]||0,  
      "Customer Talk Time %": item[7]||0,
      "Agent Talk Time %": item[8]||0,
      "Silence Time  %": item[9]||0||0,
      "IVR Time %": item[10]||0,
      "Queue Wait Time %": item[11]||0,
      "Overtalk %": item[12]||0,
      "Other(Hold/Noise/SP) %": item[12]||0,
      "Overtalk Count": item[14]||0,
      "Sentiment Score": Math.round(item[6]*100)||"NA",
      "Sentiment Trend": Math.round(item[15]*100)||"NA",
    });
    
    const resp1 = await connection.execute(fetchGroupDataCallQuery, binds1);
    // console.log("2");
    const resp2 = await connection.execute(fetchGroupDataACDQuery, binds2);

    const resp3 = await connection.execute(fetchGroupDataCustomerQuery, binds3);

    const resp4 = await connection.execute(fetchGroupDataAgentQuery, binds4);

    const resp5 = await connection.execute(fetchGroupDataSilenceQuery, binds5);
    const resp6 = await connection.execute(fetchGroupDataIVRQuery, binds6);

    const resp7 = await connection.execute(fetchGroupDataOthersQuery, binds7);

    const resp8 = await connection.execute(fetchGroupDataOvertalkQuery, binds8);
    //console.log(resp1.rows);

    const callStackData = resp1.rows.map((result) => processTotals(result));
    const ACDStackData = resp2.rows.map((result) => processTotals(result));
    const customerStackData = resp3.rows.map((result) => processTotals(result));
    const agentStackData = resp4.rows.map((result) => processTotals(result));
    const silenceStackData = resp5.rows.map((result) => processTotals(result));
    const IVRStackData = resp6.rows.map((result) => processTotals(result));
    const otherStackData = resp7.rows.map((result) => processTotals(result));
    const overtalkStackData = resp8.rows.map((result) => processTotals(result));
    


    // console.log({
    //   callStackData: callStackData,
    //   ACDStackData: ACDStackData,
    //   customerStackData: customerStackData,
    //   agentStackData: agentStackData,
    //   silenceStackData: silenceStackData,
    //   IVRStackData: IVRStackData,
    //   otherStackData: otherStackData,
    //   overtalkStackData: overtalkStackData,
    // });

    res.json({
      // callStackData: resp1.rows,
      callStackData: callStackData,
      ACDStackData: ACDStackData,
      customerStackData: customerStackData,
      agentStackData: agentStackData,
      silenceStackData: silenceStackData,
      IVRStackData: IVRStackData,
      otherStackData: otherStackData,
      overtalkStackData: overtalkStackData,
      FeedSuccess: "True",
    });
  } catch (error) {
    console.error(error);
    res.json({ FeedFail: "True" });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});



app.post("/getLOB", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];

  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }
  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }


  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

  let query = `SELECT DISTINCT TRIM(LOB) as LOB FROM CLOUD_STA_IXNS WHERE  
CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }
   query+=` ORDER BY LOB`
  // Prepare binds for query
  const binds = {};

  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });

  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query);
      // console.log("lobssss",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      //console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      res.status(200).send(dbres.rows);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.post("/getMarketSector", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  let lob = req.body.lob || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];


  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }
  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

  let query = `SELECT DISTINCT TRIM(MARKET_TYPE) as MARKET_TYPE FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }
   query+=` ORDER BY MARKET_TYPE`
  // Prepare binds for query
  const binds = {};

  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });

  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      //console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      res.status(200).send(dbres.rows);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.post("/getDivision", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];

  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }
  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

  let query = `SELECT DISTINCT TRIM(DIVISION) as DIVISION FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }
   query+=` ORDER BY DIVISION`
  // Prepare binds for query
  const binds = {};

  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });

  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      // console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      res.status(200).send(dbres.rows);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});


app.post("/getQueue", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];

  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

  let query = `SELECT DISTINCT TRIM(QUEUE) as QUEUE FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }

   query+=` ORDER BY QUEUE`
  // Prepare binds for query
  const binds = {};

  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });
  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      // console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      let st = new Set();
      dbres.rows.map((row)=>{      
        if(row[0]){
          let temp = row[0].split(',')
          temp.map(team=>{
            st.add(team.trim())
          })
        }
        })
        const queues = [...st].sort();
      res.status(200).send(queues);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.post("/getClientId", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let workTeams = req.body.workTeams || [];

  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];
  

  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }
  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

  let query = `SELECT DISTINCT TRIM(CLIENTID) as CLIENT_ID FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }
   query+=` ORDER BY CLIENT_ID`
  // Prepare binds for query
  const binds = {};

  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });
  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      //console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      res.status(200).send(dbres.rows);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.post("/getWorkTeams", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let lob = req.body.lob || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let agentId = req.body.agentId || [];
  let ANI = req.body.ANI || [];
  let partyId = req.body.partyId || [];

  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");

  let query = `SELECT DISTINCT TRIM(WORK_TEAMS) as WORK_TEAMS FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }
  query += ` ORDER BY WORK_TEAMS`

  // Prepare binds for query
  const binds = {};

  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });
  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      //console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      let st = new Set();
      dbres.rows.map((row)=>{
        if(row[0]){
          let temp = row[0].split(',')
          temp.map(team=>{
            st.add(team.trim())
          })
        }
        })       
        const teams = [...st].sort();
      res.status(200).send(teams);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.post("/getAgentId", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  
  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let ANI = req.body.ANI || [];

  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }
  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");
  const placeholdersForANI = ANI.map((_, i) => `:ANI${i + 1}`).join(", ");
 

  let query = `SELECT DISTINCT TRIM(AGENT_ID) as AGENT_ID FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (ANI.length > 0) {
    query += ` AND TRIM(ANI) IN (${placeholdersForANI})`;
  }
  query+=` ORDER BY AGENT_ID`


  // Prepare binds for query
  const binds = {};

  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });
  ANI.forEach((ANIVal, index) => {
    binds[`ANI${index + 1}`] = ANIVal;
  });
  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      // console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      let st = new Set();
      dbres.rows.map((row)=>{
        if(row[0]){
          let temp = row[0].split(',')
          temp.map(team=>{
            st.add(team.trim())
          })
        }
        })
        const agents = [...st].sort();
      res.status(200).send(agents);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.post("/getANI", (req, res) => {
  const startDate = req.body.startDate;
  let currentDate = req.body.endDate;

  let dateObject = new Date(currentDate);
  dateObject.setDate(dateObject.getDate() + 1);
  let endDate = dateObject.toISOString().split("T")[0];

  let lob = req.body.lob || [];
  let marketSector = req.body.marketSector || [];
  let division = req.body.division || [];
  let queue = req.body.queue || [];
  let clientId = req.body.clientId || [];
  let workTeams = req.body.workTeams || [];
  let agentId = req.body.agentId || [];

  let queueRegex;
  if(queue.length>1){
    queueRegex = queue.map(queue=>queue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(queue.length==1){
    queueRegex=queue[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }
  let workTeamRegex;
  if(workTeams.length>1){
    workTeamRegex = workTeams.map(team=>team.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(workTeams.length==1){
    workTeamRegex=workTeams[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  let agentIdRegex;
  if(agentId.length>1){
    agentIdRegex = agentId.map(agent=>agent.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&').join('|'))
  }else if(agentId.length==1){
    agentIdRegex=agentId[0].replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')
  }

  const placeholdersForLob = lob.map((_, i) => `:lob${i + 1}`).join(", ");
  const placeholdersForMarketSector = marketSector
    .map((_, i) => `:marketSector${i + 1}`)
    .join(", ");
  const placeholdersForDivision = division
  .map((_, i) => `:division${i + 1}`)
  .join(", ");
  const placeholdersForClientId = clientId
    .map((_, i) => `:clientId${i + 1}`)
    .join(", ");


  // Prepare placeholders for filterings

  let query = `SELECT DISTINCT TRIM(ANI) as ANI FROM CLOUD_STA_IXNS WHERE  
  CAST(startdate AS TIMESTAMP WITH TIME ZONE) >= TO_TIMESTAMP_TZ('${startDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM') 
  AND CAST(startdate AS TIMESTAMP WITH TIME ZONE) <= TO_TIMESTAMP_TZ('${endDate}', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`;

  if (lob.length > 0) {
    query += ` AND TRIM(LOB) IN (${placeholdersForLob})`;
  }
  if (marketSector.length > 0) {
    query += ` AND TRIM(MARKET_TYPE) IN (${placeholdersForMarketSector})`;
  }
  if (division.length > 0) {
    query += ` AND TRIM(DIVISION) IN (${placeholdersForDivision})`;
  }
  if (queue.length > 0) {
    query += ` AND REGEXP_LIKE(QUEUE, '${queueRegex}','i')`;
  }
  if (clientId.length > 0) {
    query += ` AND TRIM(CLIENTID) IN (${placeholdersForClientId})`;
  }
  if (workTeams.length > 0) {
    query += ` AND REGEXP_LIKE(WORK_TEAMS, '${workTeamRegex}','i')`;
  }
  if (agentId.length > 0) {
    query += ` AND REGEXP_LIKE(AGENT_ID, '${agentIdRegex}','i')`;
  }


  query+=` ORDER BY ANI`

  const binds={};
  // Prepare binds for query
  lob.forEach((lobVal, index) => {
    binds[`lob${index + 1}`] = lobVal;
  });
  marketSector.forEach((marketVal, index) => {
    binds[`marketSector${index + 1}`] = marketVal;
  });
  division.forEach((divisionVal, index) => {
    binds[`division${index + 1}`] = divisionVal;
  });
  clientId.forEach((clientVal, index) => {
    binds[`clientId${index + 1}`] = clientVal;
  });



  async function fetchDataInteractions() {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: "GEN_IXNDB",
        password: "Knu54h#I4dmE6P9a",
        connectionString: "ctip.apptoapp.org:1521/ctip_Srvc.oracle.db",
      });
      //console.log('env ', process.platform)
      const results = await connection.execute(query, binds);
      // console.log("interaction Reason",results);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  fetchDataInteractions()
    .then((dbres) => {
      //console.log(dbres);
      // console.log('env ', process.platform);
      // console.log(dbres, 'db result')
      res.status(200).send(dbres.rows);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ message: "Internal Server Error", Error: err });
    });
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

// const privateKey = fs.readFileSync('/GenApps/Certs/certificate_key', 'utf8');
// const certificate = fs.readFileSync('/GenApps/Certs/certificate', 'utf8');

// // create https server using existing certificate and private key
// const server = https.createServer({
//     key: privateKey,
//     cert: certificate
// }, app);

// server.listen(port,
//     () => {
//         console.log(`listening to PORT : http://${hostname}:${port}`);
//     })

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
