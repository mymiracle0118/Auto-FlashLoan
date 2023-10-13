import React, { Component } from 'react';

import CSVInput from './components/csv-input';
import WalletInfo from './components/wallet-info';
import OtherInput from './components/other-input';
import {toast, ToastContainer} from 'react-toastify';


import { execute, getWalletBallance, withDraw } from './services/contract';
import { SCAN_ADDRESS_PREFIX } from './const/address';

export default class App extends Component{
    constructor(props) {
        super(props)
        this.state = {
            fileName: "",
            inputData: [],
            contractBalance: {},
            timeInterval: 0,
            isStarted: false,
            hashes: [],
            v2LTVLimit: 80,
            v2LTVIncPerTx: 80,
            v3LTVLimit: 82.5,
            v3LTVIncPerTx: 82.5,
            gasDownLimit: 0,
            gasLimitPerTx: 1,
        }
        this.getWalletBallance();
    }
    getWalletBallance = async() => {
        const balance = await getWalletBallance();
        this.setState({contractBalance: balance});
    }
    inputCSV = (data, file) => {
        console.log(data)
        this.setState({
            fileName: file.name,
            inputData: data,
        });
    }
    withdraw = () => {
        withDraw();
        this.getWalletBallance();
    }
    onChangeInput = (e) => {
        this.setState({[e.target.name]: e.target.value});
    }
    execute = async(isFirst = true) => {
        if(this.state.timeInterval <= 0) {
            toast.warning('Input Correct Time Interval!', {
                position: "top-left",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "colored",
              });
            return;
        }

        let estimatedV2LTV, estimatedV3LTV;
        let currentV2LTV, currentV3LTV;
        
        let amusdcDebt = parseFloat(this.state.contractBalance.amusdcDebt);
        let amusdc = parseFloat(this.state.contractBalance.amusdc);
        currentV2LTV = amusdcDebt / amusdc;

        let vpolusdc = parseFloat(this.state.contractBalance.vpolusdc);
        let apolusdc = parseFloat(this.state.contractBalance.apolusdc);
        currentV3LTV = vpolusdc / apolusdc;

        let isRun = true;

        for(let i = 0; i < this.state.inputData.length; i++) {
            let inputAmount = parseFloat(this.state.inputData[i][2]);
            if(this.state.inputData[i][1] == 2) {
                if(this.state.inputData[i][0] === 'borrow') {
                    amusdcDebt += inputAmount;
                    estimatedV2LTV = amusdcDebt / amusdc;
                    if ((estimatedV2LTV) > this.state.v2LTVLimit / 100) {
                        toast.error('V2 LTV exceeds the set amount!', {
                            position: "top-left",
                            autoClose: 3000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            progress: undefined,
                            theme: "colored",
                        });
                        isRun = false;
                        break;
                    }
                } else if(this.state.inputData[i][0] === 'repay') {
                    amusdcDebt -= inputAmount;
                } else if(this.state.inputData[i][0] === 'return_funds') {
                    amusdc += inputAmount;
                } else if(this.state.inputData[i][0] === 'withdraw') {
                    amusdc -= inputAmount;
                } 
            } else {
                if(this.state.inputData[i][0] === 'borrow') {
                    vpolusdc += inputAmount;
                    estimatedV3LTV = vpolusdc / apolusdc;
                    if ((estimatedV3LTV) > this.state.v3LTVLimit / 100) {
                        toast.error('V3 LTV exceeds the set amount!', {
                            position: "top-left",
                            autoClose: 3000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            progress: undefined,
                            theme: "colored",
                        });
                        isRun = false;
                        break;
                    }
                } else if(this.state.inputData[i][0] === 'repay') {
                    vpolusdc -= inputAmount;
                } else if(this.state.inputData[i][0] === 'return_funds') {
                    apolusdc += inputAmount;
                } else if(this.state.inputData[i][0] === 'withdraw') {
                    apolusdc -= inputAmount;
                }
            }
        }

        if (estimatedV2LTV - currentV2LTV > this.state.v2LTVIncPerTx / 100) {
            toast.warning('V2 LTV increases more than the set amount by one tx!', {
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

        if (estimatedV3LTV - currentV3LTV > this.state.v3LTVIncPerTx / 100) {
            toast.warning('V2 LTV increases more than the set amount by one tx!', {
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

        if (isRun) {
            if (isFirst) {
                this.setState({isStarted: true})
            }
            let res;
            try{

                res = await execute(this.state.inputData, this.state.gasDownLimit, this.state.gasLimitPerTx);
                
                const balance = await getWalletBallance();

                this.setState({hashes:[...this.state.hashes, {time:Date().toString(), hash: res.hash}], contractBalance: balance});

                toast.success('Transaction Succeeded!', {
                    position: "top-left",
                    autoClose: 3000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "colored",
                });

                console.log(res);
            }
            catch(err) {
                toast.error('Transaction Failed!', {
                    position: "top-left",
                    autoClose: 3000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "colored",
                });
                this.setState({isStarted: false})
                console.log(err);
            }

            if(this.state.isStarted){
                window.setTimeout ( () => this.execute(false), this.state.timeInterval);
            }
        } else {
            this.setState({isStarted: false})
        }
    }
    stop = () => {
        this.setState({isStarted: false});
    }
    render(){
        return <div className='container'>
            <ToastContainer />
            <div className='d-flex'>
                <WalletInfo balance = {this.state.contractBalance} withdraw ={this.withdraw}/>
                <OtherInput 
                    v2LTVLimit = {this.state.v2LTVLimit}
                    v2LTVIncPerTx = {this.state.v2LTVIncPerTx}
                    v3LTVLimit = {this.state.v3LTVLimit}
                    v3LTVIncPerTx = {this.state.v3LTVIncPerTx}
                    gasDownLimit = {this.state.gasDownLimit}
                    gasLimitPerTx = {this.state.gasLimitPerTx}
                    onChangeInput = {this.onChangeInput}
                />
            </div>
            <div className='d-flex justify-content-around align-items-center'>
                <CSVInput inputCSV = {this.inputCSV}/>
                {
                    this.state.inputData.length > 0 &&
                    <div className="d-flex justify-content-around align-items-center">
                        <label className="form-label mt-3">TimeInterval</label>
                        <input type="number" className="form-control" name="timeInterval" value={this.state.timeInterval} onChange={this.onChangeInput} />
                        <div className='mt-3'>ms</div>
                        <button className="btn btn-success btn-lg mx-5" disabled={this.state.isStarted} onClick={() =>this.execute()}>Execute</button>
                        <button className="btn btn-danger btn-lg mx-5" disabled={!this.state.isStarted} onClick={() =>this.stop()}>Stop</button>
                    </div>
                }
            </div>
            {
                this.state.hashes.length > 0 && <div>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Time</th>
                                    <th scope="col">Transaction</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    this.state.hashes.map((hashItem, index) =>
                                        <tr  key={hashItem.hash}>
                                            <td>{hashItem.time}</td>
                                            <td><a href={`${SCAN_ADDRESS_PREFIX[process.env.REACT_APP_CAIN_ID]}${hashItem.hash}`}>{hashItem.hash}</a></td>
                                        </tr>)
                                }
                            </tbody>
                        </table>
                    </div>
            }

            {this.state.inputData.length > 0 &&<div>
                <table className="table">
                    <thead>
                        <tr>
                            <th scope="col">operation</th>
                            <th scope="col">version</th>
                            <th scope="col">amount</th>
                            <th scope="col">token</th>
                            <th scope="col">receiver</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            this.state.inputData.map((input, index) =>
                                <tr  key={index}>
                                    <td>{input[0]}</td>
                                    <td>{input[1]}</td>
                                    <td>{input[2]}</td>
                                    <td>{input[3]}</td>
                                    <td>{input[4]}</td>
                                </tr>)
                        }
                    </tbody>
                </table>
            </div>}
        </div>
    }
}
