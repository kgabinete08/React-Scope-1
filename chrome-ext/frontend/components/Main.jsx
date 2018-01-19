import React from 'react';
import { Component } from 'react';
import { render } from 'react-dom';

class Main extends Component {

  constructor(props) {
    super(props);    
    this.state = {
      message: 'hey there from Main Component!'
    }
  }

  componentDidMount() {
    console.log('React is running!')
    window.addEventListener('message', (event) => {
      // if (event.origin === "chrome-extension://gipfpnbcdiknjomlnphmckabkmoeebon") { //how do you get this?
      if (event.origin === "chrome-extension://" + chrome.runtime.id) { //how do you get this?
      console.log("from React: ", event.data)
        this.setState({
          message: "the first component is  " + event.data.data[0].name
        })
      }
    })
  }

  render() {
    return (
      <h1>Hello from React AND {this.state.message}</h1>
    )
  }
}

export default Main;
