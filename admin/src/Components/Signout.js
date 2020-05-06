import React from "react"
import {Redirect} from "react-router-dom"
import Cookie from "js-cookie"

const Signout = (props) => {
    props.deAuth()
    Cookie.remove('session')
    Cookie.remove('token')
    return <Redirect to='/login'/>
}

export default Signout
