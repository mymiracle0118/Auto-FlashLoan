import { ethers } from 'ethers'
import { Wallet } from 'wallet-signer'
import {toast} from 'react-toastify';

import { BOT_CONTRACT_ADDRESS, USDC_ADDRESS, amUSDC_ADDRESS, USDC_VARIABLE_DEBT_ADDRESS, vPolUSDC_ADDRESS, aPolUSDC_ADDRESS} from '../const/address';
import { BOT_CONTRACT_ABI, erc20abi, amUSDCVariableDebtabi, vPolUSDCabi } from '../const/ABI'

const OP_TYPE = {
  flashloan: 1,
  flashloan_repay: 2,
  deposit: 3,
  borrow: 4,
  repay: 5,
  withdraw: 6,
  return_funds: 7,
  add_funds: 8,
  send_token: 9,
}

const chainId = process.env.REACT_APP_CAIN_ID;
console.log(chainId);

const provider = new ethers.providers.getDefaultProvider(
  process.env.REACT_APP_ALCHEMY_POLYGON_RPC_URL
);

console.log(provider);

if (process.env.REACT_APP_PRIVATE_KEY === undefined) {
    throw new Error("Private key is not defined");
}
  
const privateKey = process.env.REACT_APP_PRIVATE_KEY;

const signer = new Wallet(privateKey, provider);

const gasPriceMul = process.env.REACT_APP_GAS_PRICE_MUL;

const botContract = new ethers.Contract(
  BOT_CONTRACT_ADDRESS[chainId],
  BOT_CONTRACT_ABI,
  provider
);


const contractUSDC = new ethers.Contract(USDC_ADDRESS[chainId], erc20abi, provider);
const contractamUSDC = new ethers.Contract(amUSDC_ADDRESS[chainId], erc20abi, provider);
const contractamUSDCVariableDebt = new ethers.Contract(USDC_VARIABLE_DEBT_ADDRESS[chainId], amUSDCVariableDebtabi, provider);
const contractaPolUSDC = new ethers.Contract(aPolUSDC_ADDRESS[chainId], erc20abi, provider);
const contractvPolUSDC = new ethers.Contract(vPolUSDC_ADDRESS[chainId], vPolUSDCabi, provider);

export const execute = async(inputArray, gasDownLimit, gasLimitPerTx) => {
  
  const flashloanFee = await botContract.connect(signer).getFlashLoanPremium();

  console.log('flashloanFee', flashloanFee)
  // const balance = getWalletBallance()

  let tokenContract;    //to approve tokens for sending

  let depositAmtTillNow = 0, initialFundUSDC = 0;
  
  let totalBorrowV2 = 0, totalBorrowV3 = 0;
  let realBorrowV2 = 0, realBorrowV3 = 0;

  let realDepositV2 = 0, realDepositV3 = 0;

  let initialFundsArray = []; 
  let indexOfArray;

  let cuFlashloanV2, cuFlashloanV3;

  let totalAddFunds = 0;

  let estGasLimit;
  let estimateGas;
  let tx, res;

  let maticBalBeforeTx, maticBalAfterTx, estMaticBal;


  if(inputArray[inputArray.length-1][0] == ""){
    inputArray.pop();
  }

  const fixedAmountArray = inputArray.map(inputItem => {
    res = parseFloat(parseFloat(inputItem[2]).toFixed(6));
    return res;
  })
  for (let i = 0; i < inputArray.length; i++){
    inputArray[i][2] = fixedAmountArray[i];
  }
  const inputTypeArray = inputArray.map(inputItem => {
    const type = OP_TYPE[inputItem[0]];

    // for initial fund of USDC
    if(type == OP_TYPE["flashloan"] || type == OP_TYPE["borrow"] || type == OP_TYPE["withdraw"] ||  type == OP_TYPE["add_funds"]){
      depositAmtTillNow -= parseFloat(inputItem[2]);
      if(type == OP_TYPE["flashloan"]){
        if(inputItem[1] == 2) {
          cuFlashloanV2 = parseFloat(inputItem[2]);
        } else {
          cuFlashloanV3 = parseFloat(inputItem[2]);
        }
      }
      if(type == OP_TYPE["add_funds"]){
        totalAddFunds += parseFloat(inputItem[2]);
      }
    } 
    else if(type == OP_TYPE["flashloan_repay"] || type == OP_TYPE["repay"] || type == OP_TYPE["deposit"] || type == OP_TYPE["send_token"]){
      if(type == OP_TYPE["flashloan_repay"]){
        if(inputItem[1] == 2) {
          console.log("cuFlashloanV2",cuFlashloanV2);
          depositAmtTillNow+= cuFlashloanV2;
          depositAmtTillNow+= cuFlashloanV2 * flashloanFee[0] * 0.00001;
        }else {
          console.log("cuFlashloanV3",cuFlashloanV3);
          depositAmtTillNow+= cuFlashloanV3;
          depositAmtTillNow+= cuFlashloanV3 * flashloanFee[1] * 0.00001;
        }
      } else {
        if(type == OP_TYPE["send_token"]){
          if(inputItem[3] == USDC_ADDRESS[chainId]) {
            depositAmtTillNow+= parseFloat(inputItem[2]);
          }
        } else {
          depositAmtTillNow+= parseFloat(inputItem[2]);
        }
      }
    } 
    if( depositAmtTillNow > initialFundUSDC ) initialFundUSDC = depositAmtTillNow;
    
    // for total debt
    if(type == OP_TYPE["borrow"]){
      if(inputItem[1] == 2){
        totalBorrowV2+= parseFloat(inputItem[2]);
      } else {
        totalBorrowV3+= parseFloat(inputItem[2]);
      }
    }

    // for real debt
    if(type == OP_TYPE["borrow"]){
      if(inputItem[1] == 2){
        realBorrowV2+= parseFloat(inputItem[2]);
      } else {
        realBorrowV3+= parseFloat(inputItem[2]);
      }
    }else if(type == OP_TYPE["repay"]){
      if(inputItem[1] == 2){
        realBorrowV2-= parseFloat(inputItem[2]);
      } else {
        realBorrowV3-= parseFloat(inputItem[2]);
      }
    }

    // for real deposit
    if(type == OP_TYPE["deposit"]){
      if(inputItem[1] == 2){
        realDepositV2+= parseFloat(inputItem[2]);
      } else {
        realDepositV3+= parseFloat(inputItem[2]);
      }
    }else if(type == OP_TYPE["withdraw"]){
      if(inputItem[1] == 2){
        realDepositV2-= parseFloat(inputItem[2]);
      } else {
        realDepositV3-= parseFloat(inputItem[2]);
      }
    }

    //for approving tokens to *send*
    if(type == OP_TYPE["send_token"]) {
      indexOfArray = initialFundsArray.findIndex(approveItem => {
        return approveItem.token == inputItem[3];
      })
      if (indexOfArray == -1) {
        initialFundsArray.push({token: inputItem[3], amount: parseFloat(inputItem[2])});
      } else {
        initialFundsArray[indexOfArray].amount+= parseFloat(inputItem[2]); 
      }
    }
    console.log("history", inputItem, depositAmtTillNow, initialFundUSDC, totalBorrowV2, totalBorrowV3);
    return type;

  });

  console.log(initialFundsArray, "initialFundsArray");
  
  console.log("depositAmtTillNow", depositAmtTillNow);
  console.log("initialFundUSDC", initialFundUSDC)
  
  // if(totalAddFunds + initialFundUSDC > 0){
  //   const approveAmt = totalAddFunds + initialFundUSDC;
  //   console.log('approve', ethers.utils.parseUnits(approveAmt.toFixed(6), 6));
  //   //approve
  //   estGasLimit = await contractUSDC.connect(signer).estimateGas.approve(BOT_CONTRACT_ADDRESS[chainId], ethers.utils.parseUnits(approveAmt.toFixed(6), 6));
  //   console.log(estGasLimit);
  //   estimateGas = await provider.getFeeData();
  //   console.log(estimateGas, "estimateGas");
  //   tx = await contractUSDC.connect(signer).approve(BOT_CONTRACT_ADDRESS[chainId], ethers.utils.parseUnits(approveAmt.toFixed(6), 6), {gasPrice: Math.trunc(estimateGas.gasPrice.toNumber() * gasPriceMul), gasLimit: estGasLimit.mul(2)});
  //   console.log('approve', initialFundUSDC, totalAddFunds, tx.hash);
  //   await tx.wait();
  // }


  //add initial fund usdc to approve tokens for sending 
  if(initialFundUSDC > 0 || totalAddFunds > 0){
    indexOfArray = initialFundsArray.findIndex(approveItem => {
      return approveItem.token == USDC_ADDRESS[chainId];
    })
    if (indexOfArray == -1) {
      initialFundsArray.push({token: USDC_ADDRESS[chainId], amount: initialFundUSDC});
    } else {
      if(initialFundUSDC > 0) initialFundsArray[indexOfArray].amount = initialFundUSDC; 
    }
  }
  console.log("initialFundsArray", initialFundsArray)
  // convert initial funds array to big number
  initialFundsArray = initialFundsArray.map(initialFundsArrayItem => ({
    amount: ethers.utils.parseUnits(initialFundsArrayItem.amount.toFixed(6), 6),
    token: initialFundsArrayItem.token
  }))

  let approveAmt, balanceBigNum;
  // approve for send tokens
  for (let i = 0; i < initialFundsArray.length; i++){

    approveAmt = initialFundsArray[i].amount;
    if(initialFundsArray[i].token == USDC_ADDRESS[chainId] && totalAddFunds > 0) {
      approveAmt = approveAmt.add(ethers.utils.parseUnits(totalAddFunds.toFixed(6), 6));
      console.log("totalAddFunds", totalAddFunds, approveAmt, initialFundsArray[i].amount);
    }

    // current matic balance
    balanceBigNum = await provider.getBalance(signer.address);
    maticBalBeforeTx = parseFloat(ethers.utils.formatEther(balanceBigNum));


    tokenContract = new ethers.Contract(initialFundsArray[i].token, erc20abi, provider)
    estGasLimit = await tokenContract.connect(signer).estimateGas.approve(BOT_CONTRACT_ADDRESS[chainId], approveAmt);
    
    estimateGas = await provider.getFeeData();

    // estimate the matic balance after tx
    estMaticBal = maticBalBeforeTx - estGasLimit.toNumber() * parseFloat(ethers.utils.formatEther(estimateGas.gasPrice)) * gasPriceMul *2;
    if(estMaticBal < gasDownLimit) {
      toastGasError();
    }

    tx = await tokenContract.connect(signer).approve(BOT_CONTRACT_ADDRESS[chainId], approveAmt, {gasPrice: Math.trunc(estimateGas.gasPrice.toNumber() * gasPriceMul), gasLimit: estGasLimit.mul(2)});
    console.log('approveForSendToken', approveAmt, tx.hash);
    await tx.wait();
    
    // calculate the matic balance after tx
    maticBalAfterTx = parseFloat(ethers.utils.formatEther(await provider.getBalance(signer.address)));
    if(maticBalBeforeTx - maticBalAfterTx > gasLimitPerTx){
      toastGasWarning();
    }
    console.log("maticBalBeforeTx, estMaticBal, maticBalAfterTx", maticBalBeforeTx, estMaticBal, maticBalAfterTx);
  }


  // if(initialFundUSDC > 0){
  //   //deposit
  //   estGasLimit = await botContract.connect(signer).estimateGas.deposit(ethers.utils.parseUnits(initialFundUSDC.toFixed(6), 6));
  //   estimateGas = await provider.getFeeData();
  //   console.log(estimateGas, "estimateGas");
  //   tx = await botContract.connect(signer).deposit(ethers.utils.parseUnits(initialFundUSDC.toFixed(6), 6), {gasPrice: Math.trunc(estimateGas.gasPrice.toNumber() * gasPriceMul), gasLimit: estGasLimit.mul(2)});
  //   await tx.wait();
  // }

  console.log("totalBorrow", totalBorrowV2, totalBorrowV3);
  //approve Delegation for total debt
  if(totalBorrowV2 > 0 ){

    // current matic balance
    balanceBigNum = await provider.getBalance(signer.address);
    maticBalBeforeTx = parseFloat(ethers.utils.formatEther(balanceBigNum));

    estGasLimit = await contractamUSDCVariableDebt.connect(signer).estimateGas.approveDelegation(BOT_CONTRACT_ADDRESS[chainId], ethers.utils.parseUnits(totalBorrowV2.toFixed(), 6));
    estimateGas = await provider.getFeeData();
    console.log(estimateGas, "estimateGas");
    
    // estimate the matic balance after tx
    estMaticBal = maticBalBeforeTx - estGasLimit.toNumber() * parseFloat(ethers.utils.formatEther(estimateGas.gasPrice)) * gasPriceMul *2;
    if(estMaticBal < gasDownLimit) {
      toastGasError();
    }

    tx = await contractamUSDCVariableDebt.connect(signer).approveDelegation(BOT_CONTRACT_ADDRESS[chainId], ethers.utils.parseUnits(totalBorrowV2.toFixed(6), 6), {gasPrice: Math.trunc(estimateGas.gasPrice.toNumber() * gasPriceMul), gasLimit: estGasLimit.mul(2)});
    await tx.wait();
    console.log(tx.hash, "totalBorrowV2");

    // calculate the matic balance after tx
    maticBalAfterTx = parseFloat(ethers.utils.formatEther(await provider.getBalance(signer.address)));
    if(maticBalBeforeTx - maticBalAfterTx > gasLimitPerTx){
      toastGasWarning();
    }
    console.log("maticBalBeforeTx, estMaticBal, maticBalAfterTx", maticBalBeforeTx, estMaticBal, maticBalAfterTx);
  }

  if(totalBorrowV3 > 0){

    // current matic balance
    balanceBigNum = await provider.getBalance(signer.address);
    maticBalBeforeTx = parseFloat(ethers.utils.formatEther(balanceBigNum));

    estGasLimit = await contractvPolUSDC.connect(signer).estimateGas.approveDelegation(BOT_CONTRACT_ADDRESS[chainId], ethers.utils.parseUnits(totalBorrowV3.toFixed(6), 6));
    estimateGas = await provider.getFeeData();
    console.log(estimateGas, "estimateGas");

    // estimate the matic balance after tx
    estMaticBal = maticBalBeforeTx - estGasLimit.toNumber() * parseFloat(ethers.utils.formatEther(estimateGas.gasPrice)) * gasPriceMul *2;
    if(estMaticBal < gasDownLimit) {
      toastGasError();
    }

    tx = await contractvPolUSDC.connect(signer).approveDelegation(BOT_CONTRACT_ADDRESS[chainId], ethers.utils.parseUnits(totalBorrowV3.toFixed(6), 6), {gasPrice: Math.trunc(estimateGas.gasPrice.toNumber() * gasPriceMul), gasLimit: estGasLimit.mul(2)});
    await tx.wait();

    // calculate the matic balance after tx
    maticBalAfterTx = parseFloat(ethers.utils.formatEther(await provider.getBalance(signer.address)));
    if(maticBalBeforeTx - maticBalAfterTx > gasLimitPerTx){
      toastGasWarning();
    }
    console.log("maticBalBeforeTx, estMaticBal, maticBalAfterTx", maticBalBeforeTx, estMaticBal, maticBalAfterTx);
  }
  
  const inputVersionArray = inputArray.map(inputItem => inputItem[1] ? inputItem[1] : '0');

  const inputAmtArray = inputArray.map(inputItem => { return ethers.utils.parseUnits(parseFloat(inputItem[2]).toFixed(6), 6)});

  const inputTokenAddressArray = inputArray.map(inputItem => inputItem[3]? inputItem[3]: "0x0000000000000000000000000000000000000000");
  const inputReceiverAddressArray = inputArray.map(inputItem => inputItem[4]? inputItem[4]: "0x0000000000000000000000000000000000000000");

  console.log("initialFundsArray", initialFundsArray);
  const initialFundsTokenArray = initialFundsArray.map(initialFundsArrayItem => initialFundsArrayItem.token);
  const initialFundsAmtArray = initialFundsArray.map(initialFundsArrayItem => initialFundsArrayItem.amount);
  console.log("initialFundsTokenArray", initialFundsTokenArray);
  console.log("initialFundsAmtArray", initialFundsAmtArray);

  console.log("inputTypeArray", inputTypeArray);
  console.log("inputAmtArray", inputAmtArray);
  console.log("inputVersionArray", inputVersionArray);
  const inputMainIntArray = inputTypeArray.concat(inputAmtArray, inputVersionArray);
  console.log('inputMainIntArray', inputMainIntArray);
  console.log("inputTokenAddressArray", inputTokenAddressArray);
  console.log("inputReceiverAddressArray", inputReceiverAddressArray);

  // current matic balance
  balanceBigNum = await provider.getBalance(signer.address);
  maticBalBeforeTx = parseFloat(ethers.utils.formatEther(balanceBigNum));

  estGasLimit = await botContract.connect(signer).estimateGas.executeBot(initialFundsTokenArray, initialFundsAmtArray, inputMainIntArray, inputTokenAddressArray, inputReceiverAddressArray);
  estimateGas = await provider.getFeeData(); 

  // estimate the matic balance after tx
  estMaticBal = maticBalBeforeTx - estGasLimit.toNumber() * parseFloat(ethers.utils.formatEther(estimateGas.gasPrice)) * gasPriceMul *2;
  if(estMaticBal < gasDownLimit) {
    toastGasError();
  }
  
  tx = await botContract.connect(signer).executeBot(initialFundsTokenArray, initialFundsAmtArray, inputMainIntArray, inputTokenAddressArray, inputReceiverAddressArray, {gasPrice: Math.trunc(estimateGas.gasPrice.toNumber() * gasPriceMul), gasLimit: estGasLimit.mul(2)} );
  
  await tx.wait();

  // calculate the matic balance after tx
  maticBalAfterTx = parseFloat(ethers.utils.formatEther(await provider.getBalance(signer.address)));
  if(maticBalBeforeTx - maticBalAfterTx > gasLimitPerTx){
    toastGasWarning();
  }

  return tx;
}

export const withDraw = async() => {
  return await botContract.connect(signer).pullFunds();
}

export const getWalletBallance = async() => {
  const balance = {};

  balance.matic= ethers.utils.formatEther(await provider.getBalance(signer.address));
  console.log(balance.usdc);

  balance.usdc= (await contractUSDC.balanceOf(signer.address)/1000000).toString();
  console.log(balance.usdc);

  balance.amusdc = (await contractamUSDC.balanceOf(signer.address)/1000000).toString();
  console.log(balance.amusdc);
  
  balance.amusdcDebt = (await contractamUSDCVariableDebt.balanceOf(signer.address)/1000000).toString();
  console.log(balance.amusdcDebt);

  balance.apolusdc = (await contractaPolUSDC.balanceOf(signer.address)/1000000).toString();
  console.log(balance.apolusdc);
  
  balance.vpolusdc = (await contractvPolUSDC.balanceOf(signer.address)/1000000).toString();
  console.log(balance.vpolusdc);
  
  return balance;
}

const toastGasWarning = () => {
  toast.warning('Gas fee exceeds the set amount by one tx!', {
    position: "top-left",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
  });
}

const toastGasError = () => {
  toast.error('Matic balance exceeds the set amount!', {
    position: "top-left",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
  });
  throw(new Error({message: 'gas limit exeeded'}))
}