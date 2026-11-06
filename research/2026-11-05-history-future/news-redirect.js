
if(!viewYEAR){
	viewYEAR = Number(new Date().getFullYear());
}
const setYEAR = Number(viewYEAR);

var redirect_url = "";

var para = location.search;
var hash = location.hash;

var chk = 0;
do{

    //redirect_url check
    $.ajax({
        type: 'GET',
        url: redirect_dir + viewYEAR + '.html',
        async: false
    }).done(function(data){
        if(data.indexOf('Page Not Found') != -1){
            viewYEAR = viewYEAR - 1;
        }else{
            //web page exists
            chk = 1;
        }
    }).fail(function(data){
        viewYEAR = viewYEAR - 1;
    });

    //5 years check
    if(chk == 0 && viewYEAR < setYEAR - 5){
        chk = -1;
        viewYEAR = setYEAR;
    }
}while(chk == 0);


redirect_url = redirect_dir + viewYEAR + '.html' + para + hash;
//redirect
location.href = redirect_url;