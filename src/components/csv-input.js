import React,{ Component } from "react";
import CSVReader from 'react-csv-reader'

export default class CSVInput extends Component{
    constructor(props){
        super(props);
    }
    render() {
        return (
            <div className="d-flex align-items-center ">
                <span className="mx-2">
                    Input CSV file:
                </span>
                <CSVReader onFileLoaded={(data, fileInfo, originalFile) => this.props.inputCSV(data, fileInfo)} />
            </div>
        )
    }
}