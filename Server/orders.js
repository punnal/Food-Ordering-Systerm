const util = require('util')
const utils = require('./utils.js')
var firebase = require('./db_initialize.js')

var escapeEmail = utils.escapeEmail
var unescapeEmail = utils.unescapeEmail


const db_orders = firebase.database().ref().child("Orders");
const db_local = firebase.database().ref().child("Local")
const db_deliveries_users = firebase.database().ref().child("Deliveries_users")
const db_deliveries = firebase.database().ref().child("Deliveries")

var db_admin = firebase.database().ref().child("admin");


function getTimeStamp(){
    d = new Date()

    var date_in_array = [d.getFullYear(), d.getMonth(), d.getDay(),  d.getHours(),  d.getMinutes(), d.getSeconds(), d.getMilliseconds()]
    
    date_in_array = date_in_array.map( (val) =>{
        val = val.toString()

        if(val.length < 2){
            val = '0' + val
        }
        return val
    })

    if(date_in_array[6].length < 3)
        date_in_array[6] = '0' + date_in_array[6]

    return date_in_array.join('')
}




function parse_options_list(item){
    if (!("options" in item)){
        return item
    }

    var option_list_names = Object.keys(item["options"])
    var option_list_choices = Object.values(item["options"])

    item["option_list_choices"] = []
    var added_price = 0

    option_list_names.forEach((list_name, i) => {
        item["option_list_choices"].push({"list_name" : list_name, "option_choice" : option_list_choices[i], "price" : item["optionsPrices"][list_name]} )
        added_price =  added_price + parseInt(item["optionsPrices"][list_name])
    });
    return [item, added_price]

}


function parse_item(item){
    var parsed_item = {}
    var added_price = 0

    var val = parse_options_list(item)
    added_price = val[1]
    parsed_item = val[0]
    delete parsed_item.options
    delete parsed_item.optionsPrices

    return [parsed_item, parseInt(parsed_item["quantity"]) * added_price]
}

function parse_deal(deal){
    var parsed_deal = {}
    
    parsed_deal["name"] = deal["name"]
    parsed_deal["price"] = deal["price"]
    parsed_deal["id"] = deal["id"]
    parsed_deal["items"] = []
    parsed_deal["quantity"] = deal["quantity"]

    var total_added_price = 0

    deal["items"].forEach(item => {
        if(!("quantity" in item))
            item["quantity"] = 1
        var parsed_item = {}
        var added_price = 0
        var val = parse_item(item)
        parsed_item = val[0]
        added_price = val[1]

        
        parsed_deal["items"].push(parsed_item)

        total_added_price += added_price
    })
    total_added_price = total_added_price * parseInt(parsed_deal["quantity"])

    return [parsed_deal, total_added_price]
}

function is_item(obj){
    if(!("items" in obj)){
        return true
    }
}




function parse_order(order){

    var parsed_order = {}
    parsed_order["email"] = order["user"]
    parsed_order["contact_no"] = order["phone"]
    parsed_order["address"] = order["address"]
    parsed_order["type"] = order["type"]
    parsed_order["items"] = []
    parsed_order["deals"] = []
    parsed_order["price"] = 0

    if("status" in order)
        parsed_order["status"] = order["status"]
    else
        parsed_order["status"] = "0"
    
    if((!("type" in parsed_order)) || typeof parsed_order["type"] == "undefined")
        parsed_order["type"] = "1"


    order["orders"].forEach(obj =>{
        
        if(typeof obj == "NaN" || typeof obj == "undefined")
            return

        if(!("quantity" in obj))
            obj["quantity"] = 1
            
        else
            obj["quantity"] = parseInt(obj["quantity"])

        obj["price"] = parseInt(obj["price"])
        


        if(!is_item(obj)){
            var added_price = 0
            var deal = {}
            var val = parse_deal(obj)

            deal = val[0]
            added_price = val[1]

            parsed_order["deals"].push(deal)            
        }
        else{
            var added_price = 0
            var val =  parse_item(obj)
            var item = val[0]
            var added_price = val[1] 
            parsed_order["items"].push(item)

        }

        parsed_order["price"] += ( ( parseInt(obj["price"]) * obj["quantity"]) + added_price)
    })

    return parsed_order
}




function post_handler(req, res){ //post request handler for handling admin side post requests.

    if(!("data" in req.body))
        return res.status(403).send("Error: Possibly incorrect format for post request.")
    

    try{
        var parsed_order = parse_order(req.body["data"])
    }
    catch(err){
        return res.status(403).send("Err: Possibly incorrect format for post request")
    }
    
    parsed_order["id"] = getTimeStamp()
    parsed_order["time"] = new Date().getTime()

    parsed_order["status"] = parsed_order["status"].toString()
    parsed_order["type"] = parsed_order["type"].toString()

    

    if(res.locals.cookieValid)
    {
        db_admin.once("value").then((admin_snapshot) => {
            
            if(admin_snapshot.val()["username"] == res.locals.uid)
            {
                parsed_order["type"] = "1"
                db_orders.child(parsed_order["id"]).set(parsed_order)
                db_local.child(parsed_order["id"]).set(parsed_order)
            }

            else
            {
                parsed_order["type"] = "0"
                parsed_order["email"] = res.locals.uid
                db_orders.child(parsed_order["id"]).set(parsed_order)
                db_deliveries.child(parsed_order["id"]).set(parsed_order)
                db_deliveries_users.child(escapeEmail(res.locals.uid)).child(parsed_order["id"]).set(parsed_order)
            }

        })

    }
    else
    {
        parsed_order["type"] = "0"
        db_deliveries.child(parsed_order["id"]).set(parsed_order)
        db_orders.child(parsed_order["id"]).set(parsed_order)
    }
    res.status(200)

    if(res.locals.cookieValid)
        return res.send({"cookieValid" : "valid"})
    else if(res.locals.cookieMissing)
        return res.send(JSON.stringify({"cookieValid" : "missing"}))
    else
        return res.send(JSON.stringify({"cookieValid" : "invalid"}))
}


const route = '/api/orders'





function get_handler(req, res){ //get request handler for serving order history
    
    console.log("order placed")
    if(!res.locals.cookieValid)
    {

        console.log("invalid cookie")
        if(res.locals.cookieMissing)
            return res.status(404).send({"data" : {}, "cookieValid" : "missing"})
        else 
            return res.status(401).send({"data" : {}, "cookieValid" : "invalid"})
    }
        
    
    var db_ref = db_orders

    db_admin.once("value").then((admin_snapshot) =>{
        console.log("uid: " + res.locals.uid)
        console.log("username " + admin_snapshot.val()["username"] )
        if(res.locals.uid != admin_snapshot.val()["username"])
        {
            
            console.log("not admin")
            db_ref = db_deliveries_users.child(escapeEmail(res.locals.uid))

            if(typeof req.query.status != 'undefined'){
                var status = req.query.status
                try{
                    db_ref.orderByChild("status").equalTo(status).once("value", (db_snapshot) =>{
                        return res.send( {"data" : db_snapshot.val() || {}, "cookueValid" : "valid"}) })
                }
                catch(err){
                    console.log("some err")
                    return res.status(200).send(JSON.stringify({"data" : {} , "cookieValid" : "valid"}))
                }
            }
            else{
                try{
                    db_ref.once("value", (db_snapshot) =>{
                        return res.send({"data" : db_snapshot.val() || {}, "cookieValid" : "valid" } )
                    })

                
                }
                catch(err)
                {
                    console.log("some err")
                    return res.status(200).send({"data" : {} , "cookieValid" : "valid"}) 
                }
                
            }
            return;
        }


        if(typeof req.query.type != 'undefined')
        {
            if (parseInt(req.query.type) == 1)
                db_ref = db_local
            else
                db_ref = db_deliveries
        }
        
        if(typeof req.query.status != 'undefined'){
            var status = req.query.status
            db_ref.orderByChild("status").equalTo(status).once("value", (db_snapshot) =>{
                return res.send( {"data" : db_snapshot.val() || {}})
            })
        }
        else{
            db_ref.once("value", (db_snapshot) =>{
                return res.send({"data" : db_snapshot.val()} )
            })
        }
    })    
}


function order_mgmt_parse_post(req){ //parses order status change request
    console.log("here starting")
    return new Promise(function(resolve, reject){
        
        var status_change_req = req.body["data"]
        if(typeof status_change_req == 'undefined' || typeof status_change_req == "null")
            reject(403)

        Object.keys(status_change_req).forEach((type_of_operation) => {
            var order = status_change_req[type_of_operation]
            if(type_of_operation == "edit"){

                if(!("id" in order) || !("status" in order))
                    reject(403)

                db_orders.child(order["id"]).once("value").then((order_snapshot) => {
                    if(order_snapshot.exists())
                    {
                        var changed_order = order_snapshot.val()
                        changed_order["status"] = order["status"].toString()
                        
                        if(parseInt(changed_order["type"]) == 1)
                        {
                            db_orders.child(changed_order["id"]).set(changed_order).then(()=> db_local.child(changed_order["id"]).set(changed_order).then(() => resolve(200)).catch(() => reject(404)) ).catch(() => reject(404))
                            console.log("here")
                        }
                        
                        if(changed_order["status"] !=  "-1")
                        {
                            console.log("norm op")  
                            db_orders.child(order["id"]).set(changed_order).then(() => {
                                if(parseInt(changed_order["type"]) == 0)
                                {
                                    console.log("in here")
                                    db_deliveries.child(order["id"]).once("value").then((user_order_snapshot) =>{
                                        console.log("it exists")
                                        if(user_order_snapshot.exists())
                                        {
                                            db_deliveries.child(order["id"]).set(changed_order).then(() => {
                                                
                                                db_deliveries_users.child(escapeEmail(changed_order["email"])).child(order["id"]).once("value").then((db_deliveries_user_snapshot) =>{
                                                    if(db_deliveries_user_snapshot.exists())
                                                    {
                                                        db_deliveries_users.child(escapeEmail(changed_order["email"])).child(order["id"]).set(changed_order).then(() => resolve(200)).catch(() => reject(404))
                                                        console.log("changed db_deliveries")
                                                    }
                                                   
                                                }).catch((err) => reject(404))

                                            })
                                            .catch(() => reject(404))
                                        }
                                        else
                                            reject(404)
                                    }).catch((err) => reject(404))

                                    
                                }
                                else
                                    db_local.child(order["id"]).set(changed_order).then(() => resolve(200)).catch(() => reject(404))
                                
                            })   
                        }
                        else
                        {
                            db_orders.child(order["id"]).remove().then(() => {
                                if(parseInt(changed_order["type"]) == 0)
                                {
                                    db_deliveries.child(order["id"]).once("value").then((user_order_snapshot) =>{
                                        if(user_order_snapshot.exists())
                                        {
                                            db_deliveries.child(order["id"]).remove().then(() => {
                                                db_deliveries_users.child(changed_order["email"]).child(order["id"]).once("value").then((db_deliveries_user_snapshot) =>{
                                                    if(db_deliveries_snapshot.exists())
                                                        db_deliveries_user_snapshot.child(changed_order["email"]).child(order["id"]).remove().then(() => resolve(200)).catch(() => reject(404))
                                                }).catch((err) => reject(404))
                                            })
                                            .catch(() => reject(404))
                                        }
                                        else
                                            reject(404)
                                    }).catch((err) => reject(404))

                                    
                                    
                                }
                                else
                                    db_local.child(order["id"]).remove().then(() => resolve(200)).catch(() => reject(404))
                                
                            })
                            
                        }
                        
                    }
                    else
                        reject(400)
                    
                }).catch(() => reject(404))
            }
            else
                reject(403)
        })
    })
}

function order_mgmt_post_handler(req, res){ //request handler for order change status
    order_mgmt_parse_post(req).then((statusCode) => res.status(statusCode).send("Status changed successfully."))
    .catch((statusCode) => res.status(statusCode).send("Could not change status. Please view status code for further details."))
}


module.exports.post_handler = post_handler
module.exports.get_handler = get_handler
module.exports.route = route


module.exports.order_mgmt_post_handler = order_mgmt_post_handler
module.exports.order_mgmt_route = '/api/orders/management'
