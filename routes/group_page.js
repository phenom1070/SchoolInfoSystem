var express = require('express');
var router = express.Router();
var ch_util = require('../util/ch_util');
var ch_query = require('../util/ch_query');
var errno = require('../util/ch_err');
var util = require('util');
var users_util = require("../users/users");
var group_access_type_def = require('../define/ch_group_access');
var group_member_data_item = ["status" ,"real_name" ,"email" ,"phone_num"];
var group_member_column_name = ["users.user_status" ,"users.real_name" ,"users.email" ,"users.phone_num"];

var group_access_type = ["Need request" ,"Open access"];
var always_exist_group = ["root" ,"hall"];


function FilterForAlterGroup(group_name_array)
{
	var need_remove_index = [];
	for(var i = 0; i < always_exist_group.length ;i++)
	{
		var index;
		if((index = group_name_array.indexOf(always_exist_group[i])) > -1)
		{
			need_remove_index.push(index);
		}
	}
	for(var i = 0 ;i < need_remove_index.length ;i++)
		group_name_array.splice(need_remove_index[i], 1);
}
function FilterForAttendGroup(group_name_array)
{
	var array_index = group_name_array.indexOf('root');
	if(array_index > -1)
			group_name_array.splice(array_index, 1);
}

var group_name_filter = [null ,FilterForAttendGroup ,FilterForAlterGroup];

router.get('/', function (req, res){
	if(req.session.user_type == 'admin')
	{
		res.sendFile(path.join(__dirname, '../public', 'groupdata.html'));
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "Please try to login!(Use admin identifier)"});
}
);


router.get('/get_members_page', function (req, res){
	if(req.session.user_type == 'admin')
	{
		res.sendFile(path.join(__dirname, '../public', 'group_members.html'));
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "Please try to login!(Use admin identifier)"});
}
);
router.get('/get_groupdata/:time_tag?', function(req ,res){
	if(req.session.user_id)
	{
		
		var cmd = "SELECT * FROM user_group WHERE find_in_set(group_name, '" + req.session.group_name +"')";
		console.log(cmd);
		var query = conn.query(cmd);
		var rows = [];
		query.on('result' , function(row){
			if(row)
			{
				rows.push(row);
			}
		}
		);
		query.on('end', function(){
			if(rows.length)
			{
				console.log(rows[0].gd_last_modified_time);
				if(rows[0].gd_last_modified_time && req.params.time_tag != rows[0].gd_last_modified_time)
				{
					//console.log("response group_data");
					res.json({errcode : CH_ERROR_SUCCESS ,msg : null , group_name : req.session.group_name ,admin_name : rows[0].group_admin ,office : rows[0].group_office ,
					phone_num : rows[0].group_phone_num ,email_addr : rows[0].group_admin_email ,
					group_status : rows[0].group_status ,data_modifier : rows[0].group_data_modifier ,
					last_modified_time : rows[0].gd_last_modified_time
					});
				}
				else
					res.json();
			}
			else
				res.json();
		});
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "Please try to login!(Use admin identifier)"});
}
);

router.post('/set_groupdata' ,function(req ,res)
{
	var time_tag = ch_util.GetCurrentTimeTag();
	if(req.session.user_type == 'admin' && req.session.group_name)
	{
		cmd = "UPDATE user_group SET group_admin = '" + ch_util.FixStr(req.body.admin_name) + "', group_office = '" + ch_util.FixStr(req.body.office) + 
		"', group_phone_num = '" + ch_util.FixStr(req.body.phone_num) + "', group_admin_email = '" + ch_util.FixStr(req.body.email_addr) + "', group_status = '" + 
		ch_util.FixStr(req.body.group_status) + "', group_data_modifier = '" + req.session.user_id + "', gd_last_modified_time = '" + time_tag + "' WHERE group_name = '" + req.session.group_name + "'";
		var query = conn.query(cmd);
		query.on('end' ,function(){
			if(req.session.client_device == 'browser')
				res.redirect('/group_page');
			else if(req.session.client_device == "CH_")
			{
				res.json({last_modified_time : time_tag ,modifier : req.session.user_id});
			}
			else
			{
				res.json({last_modified_time : time_tag ,modifier : req.session.user_id});
			}
		});
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "Please try to login!(Use admin identifier)"});
}
);

router.post('/accept_member' ,function(req ,res){
	if(req.session.user_type != 'admin')
	{
		errno.RetErrToClient(CH_ERROR_PRIVILEGE ,req ,res);
		return;
	}
	if(!users_util.AcceptMember(req.body.user_id ,req.session.group_name))
	{
		errno.RetErrToClient(errno.GetLastError() ,req ,res);
		return;
	}
	res.json({errcode : CH_ERROR_SUCCESS ,msg : null});
});

router.post('/request_attend' ,function(req ,res){
	if(!req.session.user_id)
	{
		errno.RetErrToClient(CH_ERROR_INVALID_PRIVILEGE ,req ,res);
		return;
	}
	else if(req.session.user_type != 'user')
	{
		errno.RetErrToClient(CH_ERROR_INVALID_USER_TYPE ,req ,res);
		return;
	}
	var query_obj = {rows : null};
	ch_query.QueryGroup(req.body.group_name ,"*" ,query_obj);
	if(query_obj.rows.length == 0)
	{
		errno.RetErrToClient(CH_ERROR_INVALID_PARAMETER ,req ,res);
		return;
	}
	var ui_obj = {rows : null};
	ch_query.QueryUserInfo(req.session.user_id ," request_group ,group_name" ,ui_obj);
	if(ui_obj.rows[0].request_group == req.body.group_name)
	{
		errno.RetErrToClient(CH_ERROR_INVALID_PARAMETER ,req ,res);
		return;
	}
	if(ui_obj.rows[0].group_name != ui_obj.rows[0].request_group)
	{
		if(ui_obj.rows[0].request_group)
			ch_query.RemoveUserFromGroupMembers(req.session.user_id ,ui_obj.rows[0].request_group);
	}
	var gi_obj = {rows : null};
	ch_query.QueryGroup(req.body.group_name ,"group_access_type" ,gi_obj);	
	if(gi_obj.rows[0].group_access_type === CH_GAT_NEEDREQUEST)
	{
		users_util.PostNewRequestToGroup(req.session.user_id ,req.body.group_name);
		res.json({errcode : CH_ERROR_SUCCESS ,msg : null});
	}
	else if(gi_obj.rows[0].group_access_type === CH_GAT_OPENACCESS)
	{
		users_util.ChangeGroupForUser(req.session.user_id ,req.body.group_name ,req.session.group_name);
		res.json({errcode : CH_ERROR_SUCCESS ,msg : null});
	}
	else
	{
		errno.RetErrToClient(CH_ERROR_INTERNAL_PROBLEM ,req ,res);
	}
});
router.get('/get_access_type' ,function(req ,res){
	if(req.session.user_type != 'admin')
	{
		errno.RetErrToClient(CH_ERROR_PRIVILEGE ,req ,res);
		return;
	}
	res.json({errcode: CH_ERROR_SUCCESS ,msg : null ,access_type : group_access_type});
});
router.get('/enum_group_name/:mask?' ,function(req ,res){
	if(req.params.mask)
	{
		var filter_sel;
		if(req.params.mask === 'alter')
		{
			filter_sel = 2;
		}
		else if(req.params.mask === 'attend')
		{
			filter_sel = 1;
		}
		else
		{
			errno.RetErrToClient(CH_ERROR_INVALID_PARAMETER ,req ,res);
			return;
		}
		var group_name_array = [];
		var time_obj = {changed_time : null};
		ch_query.EnumGroupName(group_name_array,time_obj);
		group_name_filter[filter_sel](group_name_array);
		res.json({errcode : CH_ERROR_SUCCESS ,msg : null ,changed_time : time_obj.changed_time ,group_names : group_name_array});
	}
	else
	{
		if(req.session.user_type !='admin')
		{
			errno.RetErrToClient(CH_ERROR_PRIVILEGE ,req ,res);
			return;
		}
		var group_name_array = [];
		var time_obj = {changed_time : null};
		ch_query.EnumGroupName(group_name_array,time_obj);
		res.json({errcode : CH_ERROR_SUCCESS ,msg : null ,changed_time : time_obj.changed_time ,group_names : group_name_array});
	}
});
router.get('/get_all_members/*' ,function(req ,res){
	if(req.session.user_type != 'admin')
	{
		var err_obj = {errmsg : null ,errdetail : null};
		errno.GetErrorInfo(CH_ERROR_INTERNAL_PROBLEM ,err_obj ,false);
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : err_obj.errmsg});
		return;
	}
	
	// let obj convert to string
	var argument_str = util.inspect(req.params[0]);
	argument_str = argument_str.slice(1,-1);
	var arg_array = argument_str.split("|");
	var member_id_column_name = req.session.group_name + "_group_members.member_id"
	var member_access_status_column_name = req.session.group_name + "_group_members.access_status";
	var query_item = [member_id_column_name ,member_access_status_column_name];
	
	for(var cnt = 0 ;cnt < arg_array.length ;cnt++)
	{
		//get and check argument is correctly
		var index_p;
		//if correct push to query_item
		if((index_p = group_member_data_item.indexOf(arg_array[cnt])) > -1)
			query_item.push(group_member_column_name[index_p]);
	}
	var gm_obj = {errcode : CH_ERROR_SUCCESS ,msg : null ,rows : null};
	if(!ch_query.EnumGroupMembers(req.session.group_name ,query_item ,gm_obj))
	{
		var err_code = errno.GetLastError();
		gm_obj.errcode = err_code;
		var err_obj = {errmsg : null ,errdetail : null};
		errno.GetErrorInfo(err_code ,err_obj ,false);
		gm_obj.msg = err_obj.errmsg;
	}
	console.log("return rows length = " ,gm_obj.rows.length);
	res.json(gm_obj);
});

router.get('/alter_group' ,function(req ,res)
{
	if(req.session.user_id != "root" || req.session.user_type != "admin")
	{
		errno.RetErrToClient(CH_ERROR_PRIVILEGE,req,res);
		return;
	}
	res.sendFile(path.join(__dirname, '../public', 'alter_group.html'));
});
router.get('/get_alter_group_error' ,function(req ,res){
	
	var alter_group_errmsg = req.session.alter_group_errmsg;
	var alter_group_group_name_remain = req.session.alter_group_group_name_remain;
	var alter_group_group_access_type_remain = req.session.alter_group_group_access_type_remain;
	var alter_group_page = req.session.alter_group_page;
	delete req.session.alter_group_errmsg ;
	delete req.session.alter_group_group_name_remain;
	delete req.session.alter_group_group_access_type_remain;
	delete req.session.alter_group_page;
	var ret_obj = {errmsg : alter_group_errmsg ,group_name_remain : alter_group_group_name_remain ,
									access_type_remain : alter_group_group_access_type_remain ,alter_page : alter_group_page};
	res.json(ret_obj);
	alter_group_errmsg = null;
	alter_group_group_name_remain =  null;
	alter_group_group_access_type_remain =  null;
	alter_group_page =  null;
	
});
router.post('/alter_group/:func' ,function(req ,res)
{
	/*-----form field-----------------------
		body.group_name
		body.group_access_type
	---------------------------------------*/
	if(req.session.user_id != 'root' || req.session.user_type != 'admin')
	{
		errno.RetErrToClient(CH_ERROR_PRIVILEGE ,req,res);
		return;
	}
	var cmd;
	var res_obj = {err : null,rows : null};
	
	if(req.params.func == 'add')
	{
		var ret = ch_query.QueryGroup(req.body.group_name ,'*' ,res_obj);
		console.log(ret);
		if(!ret && res_obj.err == null && !res_obj.rows)
		{
			console.log("begin create group");
			//is mean can create a new group
			cmd = "CREATE TABLE " + req.body.group_name + "_group_members (member_id VARCHAR(256) PRIMARY KEY ,access_status INT)";
			var create_gm_table = conn.query(cmd);
			var err_result = null;
			var err_obj = {errmsg : null ,errdetail : null};
			create_gm_table.on('err' ,function(err){
				error_result = err;
			});
			create_gm_table.on('end' ,function(){
				if(err_result)
				{
					res.json({errcode : CH_ERROR_INTERNAL_PROBLEM ,msg : "Internal problem occur in server"});
				}
				else
				{
					//continue insert group to the user_group table
					cmd = "INSERT INTO user_group (group_name ,group_access_type) VALUES ('" + req.body.group_name + "' ," + req.body.group_access_type + ")";
					var insert_new_group = conn.query(cmd);
					insert_new_group.on('error' ,function(err){
						err_result = err;
					}
					);
					insert_new_group.on('end' ,function(){
						if(err_result)
						{
							errno.RetErrToClient(CH_ERROR_INTERNAL_PROBLEM ,req ,res);
						}
						else
						{
							var time_stamp = ch_util.GetCurrentTimeTag();
							cmd = "UPDATE user_group SET row_changed_time_stamp = '" + time_stamp + "' WHERE group_name = 'root'";
							var update_time_stamp = conn.query(cmd);
							update_time_stamp.on('end' ,function(){
								if(req.session.client_device === 'browser')
								{
									res.redirect('/group_page/alter_group');
								}
								else	
									res.json({errcode : CH_ERROR_SUCCESS ,msg : null});
							});
							
						}
					});
				}
			});
		}
		else if(ret)
		{
			if(req.session.client_device === 'browser')
			{
				req.session.alter_group_errmsg = 'This group name is already exist';
				req.session.alter_group_group_name_remain = req.body.group_name;
				req.session.alter_group_group_access_type_remain = req.body.group_access_type;
				req.session.alter_group_page = 0; //add page
				res.redirect('/group_page/alter_group');
			}
			else
			{
				res.json({errcode:CH_ERROR_INVALID_PARAMETER ,errmsg : 'This group name is already exist'});
			}
		}
		else
		{
			errno.RetErrToClient(CH_ERROR_INTERNAL_PROBLEM ,req,res);
			return;
		}
	}
	else if(req.params.func == 'remove')
	{
		var gm_obj = {rows : null};
		var err_obj = {errmsg : null ,errdetail : null};
		var ret = ch_query.QueryGroup(req.body.group_name ,'*' ,gm_obj);
		if(!ret)
		{
			if(req.session.client_device === 'browser')
			{
				req.session.alter_group_errmsg = 'This group name is not exist';
				req.session.alter_group_page = 1; //remove page
				res.redirect('/group_page/alter_group');
			}
			else
			{
				res.json({errcode:CH_ERROR_INVALID_PARAMETER ,errmsg : 'This group name is not exist'});
			}
			return;
		}
		if(always_exist_group.indexOf(gm_obj.rows[0].group_name) > -1)
		{
			if(req.session.client_device === 'browser')
			{
				req.session.alter_group_errmsg = "You can't remove this group";
				req.session.alter_group_page = 1; //remove page
				res.redirect('/group_page/alter_group');
			}
			else
			{
				res.json({errcode:CH_ERROR_INVALID_PARAMETER ,errmsg : "You can't remove this group"});
			}
			return;
		}
		var member_id_column_name = req.body.group_name + "_group_members.member_id";
		var query_item = [member_id_column_name];
		if(!ch_query.EnumGroupMembers(req.body.group_name ,query_item ,gm_obj))
		{
			var err_code = errno.GetLastError();
			errno.RetErrToClient(err_code,req,res);
			return;
		}
		if(gm_obj.rows)
		{
			for(var member_index = 0 ;member_index < gm_obj.rows.length ;member_index++)
			{
				users_util.ChangeGroupForUser(gm_obj.rows[member_index].member_id ,'hall' ,null);
			}
		}
		var cmd = "DROP TABLE " + req.body.group_name + "_group_members";
		var remove_group = conn.query(cmd);
		remove_group.on('end',function(){
			cmd = "DELETE FROM user_group WHERE group_name = '" + req.body.group_name + "'";
			var remove_from_user_group = conn.query(cmd);
			remove_from_user_group.on('end' ,function(){
				var time_stamp = ch_util.GetCurrentTimeTag();
				cmd = "UPDATE user_group SET row_changed_time_stamp = '" + time_stamp + "' WHERE group_name = 'root'";
				var update_time_stamp = conn.query(cmd);
				update_time_stamp.on('end' ,function(){
					if(req.session.client_device === 'browser')
					{
						res.redirect('/group_page/alter_group');
					}
					else	
						res.json({errcode : CH_ERROR_SUCCESS ,msg : null});
				});
			});
		});
	}
	else
	{
		errno.RetErrToClient(CH_ERROR_INVALID_PARAMETER ,req ,res);
	}
}
);

module.exports = router;