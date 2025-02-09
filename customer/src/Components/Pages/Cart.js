import React from 'react'
import Axios from 'axios'
import Alert from 'react-bootstrap/Alert'

import Api from '../../api/api'

class Cart extends React.Component {

    constructor() {
        super()
        this.state = {
            minOrder: 200,
            delivery: 300,
            totalPrice: 0,
            phone: "",
            address: "",
            placed: false,
            empty: false,
        }
    }

    componentDidMount() {
        //Initilize values here
        this.setState({
            totalPrice: this.calTotalPrice(this.state.delivery),
            phone: this.props.info.phone,
            address: this.props.info.address
        })
    }
    
    // order.type === "Menu"?
    //     order.price + ((Object.values(order.optionsPrices)).reduce((a, b) => a+b, 0))*order.quantity:
    //     order.price + (order.items.reduce((acc, ord) => acc + ((Object.values(ord.optionsPrices)).reduce((a, b) => a+b, 0)), 0))*order.quantity

    calTotalPrice = (init) => this.props.orders.reduce( (total, order) => total + (
        order.type === "Menu"?
        (parseInt(order.price) + (Object.values(order.optionsPrices)).reduce((a, b) => a+parseInt(b), 0))*parseInt(order.quantity):
         (parseInt(order.price) + (order.items.reduce((acc, ord) => acc + ((Object.values(ord.optionsPrices)).reduce((a, b) => a+parseInt(b), 0)), 0)))*parseInt(order.quantity)
    ), init)

    handleClick = (type, order) => {
        
        if(type === "increase"){
            this.props.changeQuantity(order, 1, () => this.setState({totalPrice: this.calTotalPrice(this.state.delivery)}))
            this.setState({totalPrice: this.calTotalPrice(this.state.delivery)})
        } 
        else if(type === "decrease"){
            this.props.changeQuantity(order, -1, () => this.setState({totalPrice: this.calTotalPrice(this.state.delivery)}))
            this.setState({totalPrice: this.calTotalPrice(this.state.delivery)})
        } 
        else if(type === "delete"){
            this.props.deleteOrder(order, () => this.setState({totalPrice: this.calTotalPrice(this.state.delivery)}))
            this.setState({totalPrice: this.calTotalPrice(this.state.delivery)})
        } 
        else if(type === "checkOut"){
            if(this.props.orders.length === 0 || this.state.phone === "" || this.state.address === "" || (this.state.totalPrice - this.state.delivery) < this.state.minOrder){
                this.setState({empty:true}, () =>{
                    window.setTimeout(() => {
                    this.setState({empty:false})
                    }, 2000)
                }) 
                return
            }
            console.log({
                user: "guest",
                orders: this.props.orders,
                address: this.state.address,
                phone: this.state.phone,
            })
            Axios.post(Api.orders,{ "data":{
                    user: "guest",
                    orders: this.props.orders,
                    address: this.state.address,
                    phone: this.state.phone,
                }})
            this.props.resetOrders(() => this.setState({totalPrice: this.calTotalPrice(this.state.delivery)}))
            this.setState({placed:true}, () =>{
                window.setTimeout(() => {
                this.setState({placed:false})
                }, 2000)
            }) 
        } 
    }

    handleChange = (event) => {
        const {name, value} = event.target
        this.setState({ [name]: value })
    }

    listOrders = (order) => {
        console.log(order)
        return (
                <tr>
                    <td>{order.name}</td>
                    <td className = "CartClick" onClick={ () => this.handleClick("decrease", order)}>◀</td>
                    <td>{order.quantity}</td>
                    <td className = "CartClick" onClick={ () => this.handleClick("increase", order)}>▶</td>
                    <td>{(
                        order.type === "Menu"?
                            (parseInt(order.price) + (Object.values(order.optionsPrices)).reduce((a, b) => a+parseInt(b), 0))*parseInt(order.quantity):
                            (parseInt(order.price) + (order.items.reduce((acc, ord) => acc + ((Object.values(ord.optionsPrices)).reduce((a, b) => a+parseInt(b), 0)), 0)))*parseInt(order.quantity)
                    )}
                    </td>
                    <td className = "CartClick" onClick={ () => this.handleClick("delete", order)}><i class="fas fa-trash-alt"></i></td>
                </tr>    
            )
    }

    render() {
        const orders = this.props.orders.map(this.listOrders)
        return(
            <div class = "container" id = "CartMain">
                <div>
                    <div>
                        <div className = "CartMinOrder">Minimum order of {this.state.minOrder} PKR</div>
                        <table id="OgTable" class = "table table-dark table-hover">
                            <thead id="TableHead">
                                <tr>
                                    <th>Item</th>
                                    <th>Increase</th>
                                    <th>Quantity</th>
                                    <th>Decrease</th>
                                    <th>Price</th>
                                </tr>
                            </thead>
                            <tbody id="TableBody">
                                {orders}
                            </tbody>
                        </table>
                        <table id="Table" class = "table table-dark table-hover table-responsive">
                            <thead id="TableHead">
                                <tr>
                                    <th>Item</th>
                                    <th>Increase</th>
                                    <th>Quantity</th>
                                    <th>Decrease</th>
                                    <th>Price</th>
                                </tr>
                            </thead>
                            <tbody id="TableBody">
                                {orders}
                            </tbody>
                        </table>
                        <div className = "CartLine"></div>
                        <div className = "CartDeliveryFee">
                            <div>Delivery</div>
                            <div className = "Price">{this.state.delivery} PKR</div>
                        </div>
                        <div className = "CartTotal">
                            <div>Total(Including Tax)</div>
                            <div className = "Price">{this.state.totalPrice} PKR</div>
                        </div>
                    <div className = "CartPhoneAndAddress">
                        <div className = "CartPhoneLabel">Phone Number</div>
                        <div class = "form-group">
                            <input class = "form-control"
                                type="text" 
                                value={this.state.phone} 
                                name="phone" 
                                placeholder="Enter Phone Number" 
                                onChange={this.handleChange} 
                                required/>
                        </div>
                        <div className = "CartPhoneLabel">Address</div>
                        <div class = "form-group">
                            <input class = "form-control"
                                type="text" 
                                value={this.state.address} 
                                name="address" 
                                placeholder="Enter Address" 
                                onChange={this.handleChange} 
                                required/>
                        </div>
                    </div>
                        <button type="submit" className = "btn btn-dark" onClick={ () => this.handleClick("checkOut", null)}>Check Out</button>
                    </div>
                    <Alert className="AlertIncorrect" variant = "danger" show = {this.state.empty}>
                        <strong>Cart is empty or information is missing!</strong>
                    </Alert>
                    <Alert className="AlertIncorrect" variant = "success" show = {this.state.placed}>
                        <strong>Order Placed Succesfully!</strong>
                    </Alert>    
                </div>
            </div>
        )
    }

}

export default Cart
