import React,{ Component } from "react";


export default class ContractInfo extends Component{
    constructor(props){
        super(props);
    }
    render() {
        return (
            <div className="card my-5" >
                <div className="card-body">
                    Wallet Contract Info
                </div>
                <ul className="list-group list-group-flush">
                    <li className="list-group-item">usdc:{this.props.balance.usdc}</li>
                    <li className="list-group-item">amusdc:{this.props.balance.amusdc}</li>
                    <li className="list-group-item">usdc_debt:{this.props.balance.usdcDebt}</li>
                </ul>
                {/* <div className="card-footer">
                    <button className="btn btn-primary btn-lg" onClick={() => this.props.withdraw()}>Withdraw</button>
                </div> */}
            </div>
        )
    }
}